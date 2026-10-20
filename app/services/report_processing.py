"""Bound CPU work, worker lifetime, process-tree memory and concurrency."""
import ctypes
from ctypes import wintypes
from dataclasses import asdict
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
from threading import BoundedSemaphore
from app.schemas.medical_reports import ReportExtraction
from app.services.document_validation import DocumentLimits, validate_envelope
from app.services.report_errors import ReportError

class WindowsWorkerJob:
    """512 MiB aggregate and two processes; closing the job kills worker and OCR."""
    def __init__(self, process: subprocess.Popen):
        class Basic(ctypes.Structure):
            _fields_ = [('process_time', ctypes.c_int64), ('job_time', ctypes.c_int64), ('flags', wintypes.DWORD),
                        ('minimum_working_set', ctypes.c_size_t), ('maximum_working_set', ctypes.c_size_t),
                        ('active_process_limit', wintypes.DWORD), ('affinity', ctypes.c_size_t),
                        ('priority', wintypes.DWORD), ('scheduling', wintypes.DWORD)]
        class IO(ctypes.Structure):
            _fields_ = [(name, ctypes.c_uint64) for name in ['read_ops', 'write_ops', 'other_ops', 'read_bytes', 'write_bytes', 'other_bytes']]
        class Extended(ctypes.Structure):
            _fields_ = [('basic', Basic), ('io', IO), ('process_memory', ctypes.c_size_t), ('job_memory', ctypes.c_size_t),
                        ('peak_process_memory', ctypes.c_size_t), ('peak_job_memory', ctypes.c_size_t)]
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.CreateJobObjectW.argtypes, kernel.CreateJobObjectW.restype = [ctypes.c_void_p, wintypes.LPCWSTR], wintypes.HANDLE
        kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        self.kernel, self.handle = kernel, kernel.CreateJobObjectW(None, None)
        config = Extended()
        config.basic.flags = 0x2000 | 0x200 | 0x8
        config.basic.active_process_limit = 2
        config.job_memory = 512 * 1024 * 1024
        if not self.handle or not kernel.SetInformationJobObject(self.handle, 9, ctypes.byref(config), ctypes.sizeof(config)) or not kernel.AssignProcessToJobObject(self.handle, wintypes.HANDLE(int(process._handle))):
            self.close()
            raise OSError('Worker job limit unavailable')

    def close(self) -> None:
        if self.handle:
            self.kernel.CloseHandle(self.handle)
            self.handle = None

class ReportProcessingService:
    """One active document per API process; fail fast instead of queueing documents."""
    def __init__(self, limits: DocumentLimits, timeout: int = 40):
        self.limits, self.timeout = limits, timeout
        self._slot = BoundedSemaphore(1)

    def process(self, data: bytes, filename: str, mime: str) -> ReportExtraction:
        kind = validate_envelope(data, filename, mime, self.limits)
        if not self._slot.acquire(blocking=False):
            raise ReportError('report_busy', 'Another synthetic report is being processed. Try again shortly.', 429)
        process, job = None, None
        try:
            options = {'filename': 'synthetic.' + ('jpg' if kind == 'jpeg' else kind), 'mime': mime, 'limits': asdict(self.limits)}
            process = subprocess.Popen([sys.executable, '-m', 'app.services.report_worker', json.dumps(options)],
                        cwd=Path(__file__).resolve().parents[2], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), start_new_session=os.name != 'nt',
                        env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
            if os.name == 'nt':
                job = WindowsWorkerJob(process)
            stdout, _ = process.communicate(input=data, timeout=self.timeout)
            if len(stdout) > 256_000 or process.returncode:
                raise ReportError('document_processing_failed', 'The document exceeded safe worker limits or could not be processed.')
            payload = json.loads(stdout)
            if not payload['ok']:
                raise ReportError(payload['code'], payload['message'], payload['status'])
            return ReportExtraction.model_validate(payload['result'])
        except ReportError:
            raise
        except subprocess.TimeoutExpired:
            raise ReportError('document_timeout', 'Document processing exceeded its time limit. Try a smaller synthetic report.', 408) from None
        except OSError:
            raise ReportError('worker_unavailable', 'The bounded document worker could not start. Check the local setup.', 503) from None
        except Exception:
            raise ReportError('document_processing_failed', 'The synthetic document could not be processed safely.') from None
        finally:
            if job:
                job.close()
            if process is not None:
                if process.poll() is None:
                    if os.name == 'nt':
                        process.kill()
                    else:
                        os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
                for stream in [process.stdin, process.stdout, process.stderr]:
                    if stream:
                        stream.close()
            self._slot.release()

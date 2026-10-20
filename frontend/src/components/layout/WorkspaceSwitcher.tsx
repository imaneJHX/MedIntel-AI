import { useNavigate } from "react-router-dom";
import { workspaces, type WorkspaceId } from "../../utils/workspaces";
export function WorkspaceSwitcher({
  selected,
  onSwitch,
}: {
  selected?: WorkspaceId;
  onSwitch?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="workspace-switcher">
      <label htmlFor="workspace-choice">Explore a workspace</label>
      <select
        id="workspace-choice"
        value={selected ?? ""}
        onChange={(event) => {
          const next = event.target.value as WorkspaceId;
          if (next in workspaces) {
            onSwitch?.();
            navigate(workspaces[next].base);
          }
        }}
      >
        <option value="" disabled>
          Choose a workspace
        </option>
        {Object.values(workspaces).map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.title}
          </option>
        ))}
      </select>
      <span>Workspace selection does not verify identity.</span>
    </div>
  );
}

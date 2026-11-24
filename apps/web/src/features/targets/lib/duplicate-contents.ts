import {
  TARGET_KIND,
  TARGET_NAME_MAX_LENGTH,
  isTargetNameTaken,
  type TargetKind,
  type TargetResponse,
} from "@haccp/shared";

type NamedTarget = {
  id: string;
  name: string;
  kind: TargetKind;
  parentId: string | null;
};

type CopyName = (name: string, attempt: number) => string;

/** The first free copy name, shortening the original so the result stays within the length limit. */
function freeCopyName(
  taken: readonly NamedTarget[],
  source: TargetResponse,
  copyName: CopyName,
): string {
  for (let attempt = 1; ; attempt += 1) {
    const overflow =
      copyName(source.name, attempt).length - TARGET_NAME_MAX_LENGTH;
    const name = copyName(
      overflow > 0 ? source.name.slice(0, -overflow) : source.name,
      attempt,
    );
    if (
      !isTargetNameTaken(taken, { name, kind: source.kind, parentId: null })
    ) {
      return name;
    }
  }
}

/** Everything inside an area, parents first, named for its copy: components keep theirs, since names repeat across areas. */
export function planContentsCopy(
  items: readonly TargetResponse[],
  areaId: string,
  copy: { name: string; parentId: string | null },
  copyName: CopyName,
): { sourceId: string; name: string }[] {
  const taken: NamedTarget[] = [
    ...items,
    {
      id: "",
      name: copy.name,
      kind: TARGET_KIND.AREA,
      parentId: copy.parentId,
    },
  ];
  const planned: { sourceId: string; name: string }[] = [];
  let level = [areaId];

  while (level.length > 0) {
    const parents = new Set(level);
    const children = items.filter(
      (item) => item.parentId !== null && parents.has(item.parentId),
    );
    for (const child of children) {
      const name =
        child.kind === TARGET_KIND.COMPONENT
          ? child.name
          : freeCopyName(taken, child, copyName);
      taken.push({ id: "", name, kind: child.kind, parentId: null });
      planned.push({ sourceId: child.id, name });
    }
    level = children.map((child) => child.id);
  }

  return planned;
}

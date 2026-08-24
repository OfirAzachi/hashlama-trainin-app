import { TEAM_IDS } from './types';
import type { Group, GroupId, SessionTarget } from './types';

/** A distinct color per team (1-8), cycling if the roster ever has more. */
const TEAM_COLORS = [
  '#4f7cff',
  '#22a06b',
  '#c77b2b',
  '#a855f7',
  '#e2445c',
  '#0ea5b8',
  '#eab308',
  '#64748b',
];

export const GROUP_LIST: Group[] = TEAM_IDS.map((id, index) => ({
  id,
  name: `צוות ${id}`,
  shortName: `צוות ${id}`,
  description: '',
  color: TEAM_COLORS[index % TEAM_COLORS.length],
}));

export const GROUPS_BY_ID: Record<GroupId, Group> = Object.fromEntries(
  GROUP_LIST.map((group) => [group.id, group]),
) as Record<GroupId, Group>;

export function groupName(id: GroupId | null | undefined): string {
  return id ? GROUPS_BY_ID[id].name : 'ללא שיוך';
}

export function groupColor(id: GroupId | null | undefined): string {
  return id ? GROUPS_BY_ID[id].color : '#8b8b8b';
}

export function targetLabel(target: SessionTarget): string {
  return target === 'all' ? 'כל הצוותים' : GROUPS_BY_ID[target].name;
}

/** True when a session/track applies to the given participant's team. */
export function targetsGroup(target: SessionTarget, group: GroupId): boolean {
  return target === 'all' || target === group;
}

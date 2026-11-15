export function getAccessRole(role: any) {
  return role?.primary_role ?? role?.primaryRole;
}

export function getAccessRoleName(role: any): string | undefined {
  return getAccessRole(role)?.name?.toLowerCase();
}

export function hasAccessRoleIds(role: any, ids: number[]): boolean {
  const accessRoleId = getAccessRole(role)?.id;
  return ids.includes(accessRoleId);
}

export function hasAccessRoleNames(role: any, names: string[]): boolean {
  const accessRoleName = getAccessRoleName(role);
  return Boolean(accessRoleName && names.includes(accessRoleName));
}

export function toRoleResponse(role: any) {
  if (!role) {
    return null;
  }

  const primaryRole = getAccessRole(role);
  return {
    id: role.id,
    name: role.name,
    primary_role: primaryRole
      ? {
          id: primaryRole.id,
          name: primaryRole.name,
        }
      : null,
  };
}

export function toRoleParsedResponse(role: any) {
  if (!role) {
    return null;
  }

  const primaryRole = getAccessRole(role);
  return {
    role: {
      id: role.id,
      name: role.name,
    },
    primary_role: primaryRole
      ? {
          id: primaryRole.id,
          name: primaryRole.name,
        }
      : null,
  };
}

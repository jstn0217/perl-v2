import type { Request, Response } from 'express';
import type { RepositorySet } from '../repositories/index.js';
import { PERMISSION_CATALOG } from '../auth/permissionCatalog.js';
import { RoleService } from '../services/RoleService.js';
import { AuditService } from '../services/AuditService.js';
import { handleControllerError } from '../utils/errors.js';

const readRouteParam = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : null;

export const createRoleController = (repositories: RepositorySet) => {
  const roleService = new RoleService(repositories.roleRepository, repositories.userRepository);
  const auditService = new AuditService(repositories.auditRepository);

  // Role definitions are platform-wide (no owning school), so audit entries
  // for these mutations carry schoolId: null — see types/Audit.ts.
  const recordRoleAudit = async (
    req: Request,
    action: 'ROLE_CREATED' | 'ROLE_UPDATED' | 'ROLE_DEACTIVATED' | 'ROLE_REACTIVATED',
    targetId: string,
    summary: string
  ) => {
    const actor = req.currentUser;
    if (!actor) return;
    await auditService.record(null, actor, action, 'ROLE', targetId, summary);
  };

  return {
    async getPermissionCatalog(_req: Request, res: Response) {
      return res.json({ permissions: PERMISSION_CATALOG });
    },

    async list(_req: Request, res: Response) {
      const roles = await roleService.list();
      return res.json({ roles });
    },

    async create(req: Request, res: Response) {
      try {
        const role = await roleService.create(req.body ?? {});
        await recordRoleAudit(req, 'ROLE_CREATED', role.id, `Created role "${role.name}"`);
        return res.status(201).json({ role });
      } catch (error) {
        return handleControllerError(res, error, 'roleController.create');
      }
    },

    async update(req: Request, res: Response) {
      try {
        const id = readRouteParam(req.params.id);
        if (!id) return res.status(400).json({ message: 'Role ID is required.' });

        const role = await roleService.update(id, req.body ?? {});
        await recordRoleAudit(req, 'ROLE_UPDATED', role.id, `Updated role "${role.name}"`);
        return res.json({ role });
      } catch (error) {
        return handleControllerError(res, error, 'roleController.update');
      }
    },

    async deactivate(req: Request, res: Response) {
      try {
        const id = readRouteParam(req.params.id);
        if (!id) return res.status(400).json({ message: 'Role ID is required.' });

        const role = await roleService.deactivate(id);
        await recordRoleAudit(req, 'ROLE_DEACTIVATED', role.id, `Deactivated role "${role.name}"`);
        return res.json({ role });
      } catch (error) {
        return handleControllerError(res, error, 'roleController.deactivate');
      }
    },

    async reactivate(req: Request, res: Response) {
      try {
        const id = readRouteParam(req.params.id);
        if (!id) return res.status(400).json({ message: 'Role ID is required.' });

        const role = await roleService.reactivate(id);
        await recordRoleAudit(req, 'ROLE_REACTIVATED', role.id, `Reactivated role "${role.name}"`);
        return res.json({ role });
      } catch (error) {
        return handleControllerError(res, error, 'roleController.reactivate');
      }
    }
  };
};

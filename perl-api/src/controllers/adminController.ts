import type { Request, Response } from 'express';

export const createAdminController = () => {
  return {
    getSchoolSummary(req: Request, res: Response) {
      return res.json({
        schoolId: req.params.schoolId,
        user: req.currentUser
      });
    }
  };
};

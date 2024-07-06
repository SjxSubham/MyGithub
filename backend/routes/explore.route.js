import express from 'express';
import {explorePopularRepos} from "../controllers/explore.controller.js";
import { ensureAuthenticated } from '../middleware/ensureAuthenticated.js';

const router = express.Router();

router.get("/repos/:language", ensureAuthenticated, explorePopularRepos);
// we have to make who likes my rpofile
// most likes profile

export default router;
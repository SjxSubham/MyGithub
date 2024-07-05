import express from 'express';
import {explorePopularRepos} from "../controllers/explore.controller.js";

const router = express.Router();

router.get("/repos/:language", explorePopularRepos);
// we have to make who likes my rpofile
// most likes profile

export default router;
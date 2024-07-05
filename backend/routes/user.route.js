import express from "express";
import {getUserProfileAndRepos} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/profile/:username", getUserProfileAndRepos);
// we have to make who likes my rpofile
// most likes profile

export default router;
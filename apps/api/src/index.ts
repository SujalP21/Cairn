#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { startServer } from "./server";
import { initRepo } from "./controllers/init";
import { addRepo } from "./controllers/add";
import { commitRepo } from "./controllers/commit";
import { pushRepo } from "./controllers/push";
import { pullRepo } from "./controllers/pull";
import { revertRepo } from "./controllers/revert";

void yargs(hideBin(process.argv))
  .scriptName("cairn")
  .command("start", "Starts a new server", {}, () => {
    void startServer();
  })
  .command("init", "Initialise a new repository", {}, () => {
    void initRepo();
  })
  .command(
    "add <file>",
    "Add a file to the repository",
    (y) =>
      y.positional("file", {
        describe: "File to add to the staging area",
        type: "string",
        demandOption: true,
      }),
    (argv) => {
      void addRepo(argv.file);
    }
  )
  .command(
    "commit <message>",
    "Commit the staged files",
    (y) =>
      y.positional("message", {
        describe: "Commit message",
        type: "string",
        demandOption: true,
      }),
    (argv) => {
      void commitRepo(argv.message);
    }
  )
  .command("push", "Push commits to S3", {}, () => {
    void pushRepo();
  })
  .command("pull", "Pull commits from S3", {}, () => {
    void pullRepo();
  })
  .command(
    "revert <commitID>",
    "Revert to a specific commit",
    (y) =>
      y.positional("commitID", {
        describe: "Commit ID to revert to",
        type: "string",
        demandOption: true,
      }),
    (argv) => {
      void revertRepo(argv.commitID);
    }
  )
  .demandCommand(1, "You need at least one command")
  .strict()
  .help().argv;

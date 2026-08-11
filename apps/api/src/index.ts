#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { startServer } from "./server";
import { initRepo } from "./vcs/commands/init";
import { addRepo } from "./vcs/commands/add";
import { commitRepo } from "./vcs/commands/commit";
import { logRepo } from "./vcs/commands/log";
import { statusRepo } from "./vcs/commands/status";
import { diffRepo } from "./vcs/commands/diff";
import { branchRepo } from "./vcs/commands/branch";
import { checkoutRepo } from "./vcs/commands/checkout";
import { mergeRepo } from "./vcs/commands/merge";
import { pushRepo } from "./vcs/commands/push";
import { pullRepo } from "./vcs/commands/pull";
import { revertRepo } from "./vcs/commands/revert";

void yargs(hideBin(process.argv))
  .scriptName("cairn")
  .usage("$0 <command> [options]")

  .command("start", "Start the API server", {}, () => {
    void startServer();
  })

  // -- Working with a repository --------------------------------------------
  .command("init", "Create a repository in the current directory", {}, () => {
    void initRepo();
  })

  .command(
    "add <path>",
    "Stage a file or directory",
    (y) =>
      y.positional("path", {
        describe: "File or directory to stage",
        type: "string",
        demandOption: true,
      }),
    (argv) => {
      void addRepo(argv.path);
    }
  )

  .command(
    "commit <message>",
    "Record the staged files as a new commit",
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

  .command("status", "Show staged, unstaged and untracked changes", {}, () => {
    void statusRepo();
  })

  .command(
    "log",
    "Show commit history, newest first",
    (y) =>
      y.option("limit", {
        alias: "n",
        describe: "Maximum number of commits to show",
        type: "number",
        default: 20,
      }),
    (argv) => {
      void logRepo(argv.limit);
    }
  )

  .command(
    "diff",
    "Show what changed",
    (y) =>
      y.option("staged", {
        describe:
          "Compare HEAD against the staging area instead of the working tree",
        type: "boolean",
        default: false,
      }),
    (argv) => {
      void diffRepo(argv.staged);
    }
  )

  // -- Branches --------------------------------------------------------------
  .command(
    "branch [name]",
    "List branches, or create one",
    (y) =>
      y
        .positional("name", {
          describe: "Name of the branch to create",
          type: "string",
        })
        .option("delete", {
          alias: "d",
          describe: "Delete the named branch",
          type: "boolean",
          default: false,
        }),
    (argv) => {
      void branchRepo(argv.name, { delete: argv.delete });
    }
  )

  .command(
    "checkout <target>",
    "Switch to a branch or commit",
    (y) =>
      y
        .positional("target", {
          describe: "Branch name or commit id",
          type: "string",
          demandOption: true,
        })
        .option("force", {
          alias: "f",
          describe: "Discard uncommitted changes",
          type: "boolean",
          default: false,
        }),
    (argv) => {
      void checkoutRepo(argv.target, { force: argv.force });
    }
  )

  .command(
    "merge <branch>",
    "Fast-forward the current branch to another",
    (y) =>
      y.positional("branch", {
        describe: "Branch to merge in",
        type: "string",
        demandOption: true,
      }),
    (argv) => {
      void mergeRepo(argv.branch);
    }
  )

  .command(
    "revert <commitID>",
    "Restore the working tree from a commit, leaving HEAD alone",
    (y) =>
      y
        .positional("commitID", {
          describe: "Commit id, or a unique prefix of one",
          type: "string",
          demandOption: true,
        })
        .option("force", {
          alias: "f",
          describe: "Discard uncommitted changes",
          type: "boolean",
          default: false,
        }),
    (argv) => {
      void revertRepo(argv.commitID, { force: argv.force });
    }
  )

  // -- Remote ----------------------------------------------------------------
  .command("push", "Upload objects and refs to S3", {}, () => {
    void pushRepo();
  })

  .command("pull", "Download objects and refs from S3", {}, () => {
    void pullRepo();
  })

  .demandCommand(1, "You need at least one command")
  .strict()
  .help()
  .alias("help", "h").argv;

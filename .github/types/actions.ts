import type * as core from '@actions/core';
import type { context, getOctokit } from '@actions/github';

export type Context = typeof context;
export type Core = typeof core;
export type GitHub = ReturnType<typeof getOctokit>;

export type ActionOptions = {
  github: GitHub;
  context: Context;
  core: Core;
};

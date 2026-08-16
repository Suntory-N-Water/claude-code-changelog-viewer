export class WorkflowEntrypoint<Env = unknown, Params = unknown> {
  protected readonly env!: Env;
  protected readonly params!: Params;
}

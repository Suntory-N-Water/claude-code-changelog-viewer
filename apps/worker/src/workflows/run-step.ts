import type {
  WorkflowStep,
  WorkflowStepConfigWithStaticDelay,
} from 'cloudflare:workers';
import { workerLogger } from '../logger';

const logger = workerLogger('workflows.step');

export function createStepRunner(step: WorkflowStep) {
  return async <T extends Rpc.Serializable<T>>(
    name: string,
    {
      attrs,
      ...config
    }: WorkflowStepConfigWithStaticDelay & {
      attrs?: Record<string, unknown>;
    },
    fn: () => Promise<T>,
  ): Promise<T> => {
    const result = await step.do(name, config, fn);
    logger.info('Workflow step が完了しました', {
      'workflow.step': name,
      ...attrs,
    });
    return result;
  };
}

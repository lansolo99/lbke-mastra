import { mastra } from './mastra/index.js';

const agent = mastra.getAgent('stackPickerAgent');

const resource = 'user-test';
const thread = 'thread-test-1';

const reply1 = await agent.generate('Recommend a stack for a small 3D game', {
  memory: { resource, thread },
});
console.log('Turn 1:', reply1.text);

const reply2 = await agent.generate('What did you recommend me?', {
  memory: { resource, thread },
});
console.log('Turn 2:', reply2.text);

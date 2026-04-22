const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');

const issueData = JSON.parse(fs.readFileSync('./issue.json', 'utf8'));
const eventData = JSON.parse(fs.readFileSync('./event.json', 'utf8'));
const issueNumber = process.env.ISSUE_NUMBER;
const repo = process.env.REPO;

const isComment = process.env.GITHUB_EVENT_NAME === 'issue_comment';
const commentBody = isComment ? eventData.comment.body : null;
const commentAuthor = isComment ? eventData.comment.user.login : issueData.user.login;

const messages = [
  {
    role: 'system',
    content: 'You are a helpful AI assistant. Issue title is the topic, body is context, comments are conversation history. Keep responses concise and helpful.'
  }
];

if (isComment && issueData.comments && issueData.comments.length > 0) {
  const history = issueData.comments
    .map(c => `**${c.author.login}:** ${c.body}`)
    .join('\n');
  messages.push({
    role: 'user',
    content: `Issue Title: ${issueData.title}\n\n---Conversation History---\n${history}\n\n---\nNew message from ${commentAuthor}:\n${commentBody}`
  });
} else {
  messages.push({
    role: 'user',
    content: `Issue Title: ${issueData.title}\n\nIssue Body:\n${issueData.body || '(empty)'}`
  });
}

const requestBody = {
  model: 'openrouter/free',
  messages
};

const data = JSON.stringify(requestBody);

const options = {
  hostname: 'openrouter.ai',
  path: '/api/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'HTTP-Referer': `https://github.com/${repo}`,
    'X-Title': 'AI Issue Reply'
  }
};

const result = await new Promise((resolve, reject) => {
  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => resolve(body));
  });
  req.on('error', reject);
  req.write(data);
  req.end();
});

const response = JSON.parse(result);
console.log('Response:', JSON.stringify(response, null, 2));

const aiReply = response.choices?.[0]?.message?.content;
if (aiReply) {
  const cmd = `gh issue comment ${issueNumber} --body "@${commentAuthor} ${aiReply}"`;
  console.log('Executing:', cmd);
  execSync(cmd, { env: { ...process.env, GITHUB_TOKEN: process.env.GH_TOKEN } });
  console.log('Reply posted!');
}
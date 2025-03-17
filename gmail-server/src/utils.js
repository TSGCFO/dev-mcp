const marked = require('marked');

function markdownToHtml(markdown) {
  return marked.parse(markdown);
}

function formatEmailForSending({ to, subject, body, isHtml = false }) {
  const email = {
    to,
    subject,
    [isHtml ? 'html' : 'text']: body
  };
  return email;
}

function buildSearchQuery(criteria) {
  const parts = [];
  if (criteria.from) parts.push(`from:${criteria.from}`);
  if (criteria.to) parts.push(`to:${criteria.to}`);
  if (criteria.subject) parts.push(`subject:${criteria.subject}`);
  if (criteria.hasAttachment) parts.push('has:attachment');
  if (criteria.query) parts.push(criteria.query);
  return parts.join(' ');
}

function formatEmailThread(messages) {
  return messages.map(msg => {
    const headers = msg.payload.headers;
    return {
      id: msg.id,
      threadId: msg.threadId,
      from: headers.find(h => h.name === 'From')?.value,
      to: headers.find(h => h.name === 'To')?.value,
      subject: headers.find(h => h.name === 'Subject')?.value,
      date: headers.find(h => h.name === 'Date')?.value,
      snippet: msg.snippet
    };
  });
}

module.exports = {
  markdownToHtml,
  formatEmailForSending,
  buildSearchQuery,
  formatEmailThread
};

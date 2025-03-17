const { marked } = require('marked');
const juice = require('juice');
const { htmlToText } = require('html-to-text');
const moment = require('moment');

// Convert markdown to HTML with styling
function markdownToHtml(markdown) {
  const html = marked(markdown);
  const styledHtml = juice(`
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; }
      h1, h2, h3 { color: #333; }
      a { color: #0066cc; }
      blockquote { border-left: 3px solid #ccc; padding-left: 10px; color: #666; }
      pre { background: #f4f4f4; padding: 10px; border-radius: 4px; }
      code { background: #f4f4f4; padding: 2px 4px; border-radius: 2px; }
    </style>
    ${html}
  `);
  return styledHtml;
}

// Extract text content from HTML
function extractTextFromHtml(html) {
  return htmlToText(html, {
    wordwrap: 130,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } }
    ]
  });
}

// Format email thread for display
function formatEmailThread(messages) {
  return messages.map(msg => {
    const sender = msg.sender?.emailAddress || {};
    const recipients = msg.toRecipients?.map(r => r.emailAddress) || [];
    
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      subject: msg.subject,
      from: sender.address,
      fromName: sender.name,
      to: recipients.map(r => r.address),
      toNames: recipients.map(r => r.name),
      receivedDateTime: moment(msg.receivedDateTime).format('YYYY-MM-DD HH:mm:ss'),
      body: msg.body?.content,
      isHtml: msg.body?.contentType === 'HTML',
      hasAttachments: msg.hasAttachments,
      importance: msg.importance,
      categories: msg.categories || [],
      isRead: msg.isRead,
      isDraft: msg.isDraft,
      webLink: msg.webLink
    };
  });
}

// Build search query from criteria
function buildSearchQuery(criteria) {
  const conditions = [];

  if (criteria.subject) {
    conditions.push(`subject:${criteria.subject}`);
  }
  if (criteria.from) {
    conditions.push(`from:${criteria.from}`);
  }
  if (criteria.to) {
    conditions.push(`to:${criteria.to}`);
  }
  if (criteria.after) {
    conditions.push(`received:>${criteria.after}`);
  }
  if (criteria.before) {
    conditions.push(`received:<${criteria.before}`);
  }
  if (criteria.hasAttachment) {
    conditions.push('hasAttachments:true');
  }
  if (criteria.folder) {
    conditions.push(`folder:${criteria.folder}`);
  }
  if (criteria.category) {
    conditions.push(`category:${criteria.category}`);
  }
  if (criteria.isUnread) {
    conditions.push('isRead:false');
  }
  if (criteria.keywords) {
    conditions.push(criteria.keywords);
  }

  return conditions.join(' AND ');
}

// Format email for sending
async function formatEmailForSending(client, { to, subject, body, isHtml = false, attachments = [] }) {
  const message = {
    subject,
    body: {
      contentType: isHtml ? 'HTML' : 'Text',
      content: body
    },
    toRecipients: [
      {
        emailAddress: {
          address: to
        }
      }
    ]
  };

  if (attachments.length > 0) {
    message.attachments = await Promise.all(attachments.map(async (attachment) => {
      const content = await fs.promises.readFile(attachment.path, { encoding: 'base64' });
      return {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachment.filename,
        contentType: attachment.contentType,
        contentBytes: content
      };
    }));
  }

  return message;
}

// Get folder ID by name
async function getFolderId(client, folderName) {
  const response = await client.api('/me/mailFolders')
    .filter(`displayName eq '${folderName}'`)
    .get();

  if (!response.value || response.value.length === 0) {
    throw new Error(`Folder "${folderName}" not found`);
  }

  return response.value[0].id;
}

// Get category ID by name
async function getCategoryId(client, categoryName) {
  const response = await client.api('/me/outlook/masterCategories')
    .filter(`displayName eq '${categoryName}'`)
    .get();

  if (!response.value || response.value.length === 0) {
    // Create category if it doesn't exist
    const newCategory = await client.api('/me/outlook/masterCategories')
      .post({
        displayName: categoryName,
        color: 'preset0' // Default color
      });
    return newCategory.id;
  }

  return response.value[0].id;
}

module.exports = {
  markdownToHtml,
  extractTextFromHtml,
  formatEmailThread,
  buildSearchQuery,
  formatEmailForSending,
  getFolderId,
  getCategoryId
};
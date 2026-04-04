// Extracted from dashboard.js — Team Management, Invites, Messaging
// ==========================================
// ==========================================
// TEAM MANAGEMENT
// ==========================================
async function loadTeam() {
  if (!currentProfile?.organization_id) {
    document.getElementById('teamListBody').innerHTML =
      '<div class="empty-state"><h3>Keine Organisation</h3><p>Dein Account ist keiner Organisation zugeordnet.</p></div>';
    return;
  }
  const result = await clanaDB.getOrganization(currentProfile.organization_id);
  if (!result.success || !result.data?.organization_members) {
    document.getElementById('teamListBody').innerHTML =
      '<div class="empty-state"><h3>Keine Teammitglieder</h3><p>Lade Teammitglieder ein.</p></div>';
    return;
  }
  const members = result.data.organization_members;
  document.getElementById('teamCount').textContent = members.length + ' Mitglieder';

  if (members.length === 0) {
    document.getElementById('teamListBody').innerHTML =
      '<div class="empty-state"><h3>Keine Teammitglieder</h3><p>Lade Teammitglieder ein.</p></div>';
    return;
  }

  let html = '<div class="table-wrap"><table><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Beigetreten</th></tr></thead><tbody>';
  members.forEach(m => {
    const p = m.profiles || {};
    html += '<tr>' +
      '<td style="font-weight:600;">' + escHtml((p.first_name || '') + ' ' + (p.last_name || '')) + '</td>' +
      '<td>' + escHtml(p.email || '') + '</td>' +
      '<td><span class="status-badge completed">' + (m.role_in_org || 'member') + '</span></td>' +
      '<td>' + clanaUtils.formatDate(m.created_at) + '</td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';
  document.getElementById('teamListBody').innerHTML = html;
}

function inviteTeamMember() {
  document.getElementById('inviteEmail').value = '';
  document.getElementById('inviteRole').value = 'member';
  document.getElementById('modal-invite-member').classList.add('active');
}

function closeInviteModal() {
  document.getElementById('modal-invite-member').classList.remove('active');
}

function sendInvite() {
  const email = document.getElementById('inviteEmail').value.trim();
  const role = document.getElementById('inviteRole').value;

  if (!email || !clanaUtils.validateEmail(email)) {
    showToast('Bitte eine gueltige E-Mail-Adresse eingeben.', true);
    return;
  }

  closeInviteModal();
  showToast('Einladung an ' + email + ' als ' + role + ' gesendet.');
}

// ==========================================
// MESSAGING
// ==========================================
async function loadConversations() {
  const result = await clanaDB.getConversations();
  if (!result.success || !result.data?.length) {
    document.getElementById('conversationsList').innerHTML =
      '<div class="empty-state" style="padding:24px;"><h3>Keine Nachrichten</h3><p>Starte eine Konversation.</p></div>';
    return;
  }

  document.getElementById('conversationsList').innerHTML = result.data.map(c => {
    const lastMsg = c.messages?.length ? c.messages[c.messages.length - 1] : null;
    const participants = (c.conversation_participants || []).map(p => {
      const profile = p.profiles;
      return profile ? (profile.first_name || '') + ' ' + (profile.last_name || '') : '';
    }).filter(Boolean).join(', ');

    return '<div class="phone-item" style="cursor:pointer;padding:12px;" onclick="openConversation(\'' + c.id + '\')">' +
      '<div style="font-weight:600;font-size:13px;margin-bottom:2px;">' + escHtml(c.subject || participants || 'Konversation') + '</div>' +
      (lastMsg ? '<div style="font-size:11px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(lastMsg.content).substring(0, 60) + '</div>' : '') +
    '</div>';
  }).join('');
}

async function openConversation(convId) {
  currentConversationId = convId;
  document.getElementById('messageInputArea').style.display = 'block';

  const result = await clanaDB.getMessages(convId);
  if (!result.success) { showToast('Fehler beim Laden der Nachrichten', true); return; }

  const area = document.getElementById('messageArea');
  if (!result.data?.length) {
    area.innerHTML = '<div class="empty-state"><p>Noch keine Nachrichten in dieser Konversation.</p></div>';
    return;
  }

  area.innerHTML = result.data.map(m => {
    const isMe = m.sender_id === currentUser?.id;
    const sender = m.profiles ? (m.profiles.first_name || '') + ' ' + (m.profiles.last_name || '') : 'Unbekannt';
    const time = new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    return '<div style="margin-bottom:12px;text-align:' + (isMe ? 'right' : 'left') + ';">' +
      '<div style="display:inline-block;max-width:70%;background:' + (isMe ? 'rgba(124,58,237,.15)' : 'var(--card)') + ';border:1px solid var(--border);border-radius:12px;padding:10px 14px;text-align:left;">' +
        '<div style="font-size:11px;color:var(--tx3);margin-bottom:4px;">' + escHtml(sender) + ' &middot; ' + time + '</div>' +
        '<div style="font-size:13px;">' + escHtml(m.content) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  area.scrollTop = area.scrollHeight;

  await clanaDB.markConversationRead(convId);
}

async function sendMessage() {
  if (!currentConversationId) return;
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;

  input.value = '';
  const result = await clanaDB.sendMessage(currentConversationId, content);
  if (result.success) {
    openConversation(currentConversationId);
    loadConversations();
  } else {
    showToast('Fehler beim Senden: ' + result.error, true);
  }
}

function startNewConversation() {
  document.getElementById('convSubject').value = '';
  document.getElementById('convMessage').value = '';
  document.getElementById('modal-new-conversation').classList.add('active');
}

function closeNewConvModal() {
  document.getElementById('modal-new-conversation').classList.remove('active');
}

async function createNewConversation() {
  const subject = document.getElementById('convSubject').value.trim();
  const message = document.getElementById('convMessage').value.trim();

  if (!message) {
    showToast('Bitte eine Nachricht eingeben.', true);
    return;
  }

  const convResult = await clanaDB.createConversation([], subject || 'Neue Konversation');
  if (!convResult.success) {
    showToast('Fehler beim Erstellen: ' + convResult.error, true);
    return;
  }

  const msgResult = await clanaDB.sendMessage(convResult.data.id, message);
  if (!msgResult.success) {
    showToast('Konversation erstellt, aber Nachricht konnte nicht gesendet werden.', true);
  }

  closeNewConvModal();
  await loadConversations();
  openConversation(convResult.data.id);
}

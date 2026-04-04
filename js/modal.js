// ==========================================
// Global Modal System: open, close, ESC key, overlay click
// Standalone — no dependencies
// ==========================================

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  el.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  el.classList.remove('active');
  // Restore scroll if no other modals are open
  if (!document.querySelector('.modal-overlay.active')) {
    document.body.style.overflow = '';
  }
}

// ESC key closes the topmost modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModals = document.querySelectorAll('.modal-overlay.active');
    if (openModals.length > 0) {
      const last = openModals[openModals.length - 1];
      closeModal(last.id);
    }
  }
});

// Click overlay background to close
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
    closeModal(e.target.id);
  }
});

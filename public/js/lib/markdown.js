const MD = {
  render(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined' && marked.parse) {
      return marked.parse(text);
    }
    // Fallback: basic markdown
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  },
};

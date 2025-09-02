document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
});

const dropdownLabel = document.getElementById('dropdown-label');
const dropdownOptions = document.getElementById('dropdown-options');
const selectedModelSpan = document.getElementById('selected-model');
const hiddenInput = document.getElementById('model-select');

dropdownLabel.addEventListener('click', () => {
  const expanded = dropdownLabel.getAttribute('aria-expanded') === 'true';
  dropdownLabel.setAttribute('aria-expanded', String(!expanded));

  if (dropdownOptions.style.display === 'block') {
    dropdownOptions.style.display = 'none';
  } else {
    dropdownOptions.style.display = 'block';

    const rect = dropdownLabel.getBoundingClientRect();
    dropdownOptions.style.position = 'absolute';
    dropdownOptions.style.top = rect.bottom + window.scrollY + 'px';
    dropdownOptions.style.left = rect.left + window.scrollX + 'px';
    dropdownOptions.style.width = rect.width + 'px';
  }
});


dropdownOptions.addEventListener('click', (event) => {
  if (event.target.tagName === 'LI') {
    selectedModelSpan.textContent = event.target.textContent;
    hiddenInput.value = event.target.getAttribute('data-value');
    dropdownOptions.style.display = 'none';
    dropdownLabel.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('click', (event) => {
  if (!dropdownLabel.contains(event.target) && !dropdownOptions.contains(event.target)) {
    dropdownOptions.style.display = 'none';
    dropdownLabel.setAttribute('aria-expanded', 'false');
  }
});

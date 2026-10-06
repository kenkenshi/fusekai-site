/* 既存の検索・フォーム・作品データを共用するPC用ナビと本棚。 */
function desktopHome() {
  restoreNoResultsHome();
  resultArea.style.display = 'none';
  noResults.style.display = 'none';
  suggestToast.style.display = 'none';
  showPage('page-top');
}
function desktopBackToBooks() {
  if (currentFeedStatus) openFeed(currentFeedStatus);
  else desktopHome();
}
window.syncDesktopNav = function() {
  const page = document.querySelector('.page.active')?.id;
  const key = page === 'page-feed' ? currentFeedStatus : page;
  document.querySelectorAll('[data-desktop-page]').forEach(button => {
    if (button.dataset.desktopPage === key) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
};
window.renderDesktopShelf = function() {
  const entries = feedItems.read.slice(0,4);
  const shelf = document.getElementById('desktop-shelf');
  document.getElementById('desktop-shelf-books').innerHTML = entries.map(feedCardHtml).join('');
  shelf.hidden = !entries.length;
};
document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.feed-card[role="button"]')) {
    event.preventDefault();
    event.target.click();
  }
});
renderDesktopShelf();
syncDesktopNav();

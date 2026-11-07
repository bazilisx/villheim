/**
 * Villheim design review sheet: shows one gallery page at a time on the Review and Pass 2 tabs.
 *
 * Install once: in the sheet, Extensions > Apps Script, replace everything there with this file, save.
 * No authorisation is needed: it only uses simple triggers (onEdit, onOpen).
 *
 * Top bar of each tab: a tick box to go back one page, the page shown (type a number to jump), a tick box for the
 * next page. Review: E1, F1, G1. Pass 2: D1, E1, F1.
 * Menu "Villheim review": next page, back one page, show every page.
 */

var TABS = {
  'Review': { back: 5, page: 6, next: 7 },
  'Pass 2': { back: 4, page: 5, next: 6 },
};
var FIRST_ROW = 3; // rows 1 and 2 are the top bar and the headings

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Villheim review')
    .addItem('Next page', 'nextPage')
    .addItem('Back one page', 'previousPage')
    .addItem('Show every page', 'showAll')
    .addToUi();
}

function onEdit(e) {
  var sheet = e.range.getSheet();
  var tab = TABS[sheet.getName()];
  if (!tab || e.range.getRow() !== 1) {
    return;
  }

  var column = e.range.getColumn();
  var page = currentPage_(sheet);
  if (column === tab.back && e.value === 'TRUE') {
    e.range.setValue(false);
    showPage_(sheet, Math.max(1, page - 1));
  } else if (column === tab.next && e.value === 'TRUE') {
    e.range.setValue(false);
    showPage_(sheet, Math.min(lastPage_(sheet), page + 1));
  } else if (column === tab.page) {
    var wanted = Number(e.value);
    if (wanted >= 1) {
      showPage_(sheet, Math.min(lastPage_(sheet), Math.round(wanted)));
    }
  }
}

function nextPage() {
  var sheet = review_();
  showPage_(sheet, Math.min(lastPage_(sheet), currentPage_(sheet) + 1));
}

function previousPage() {
  var sheet = review_();
  showPage_(sheet, Math.max(1, currentPage_(sheet) - 1));
}

function showAll() {
  var sheet = review_();
  sheet.showRows(FIRST_ROW, sheet.getMaxRows() - FIRST_ROW + 1);
}

function showPage_(sheet, page) {
  var rows = data_(sheet);
  sheet.showRows(FIRST_ROW, rows.length);
  var start = -1;
  for (var i = 0; i <= rows.length; i++) {
    var hide = i < rows.length && Number(rows[i][0]) !== page;
    if (hide && start < 0) {
      start = i;
    } else if (!hide && start >= 0) {
      sheet.hideRows(FIRST_ROW + start, i - start);
      start = -1;
    }
  }

  sheet.getRange(1, TABS[sheet.getName()].page).setValue(page);
  sheet.getRange(FIRST_ROW, 3).activate();
}

function data_(sheet) {
  return sheet.getRange(FIRST_ROW, 1, sheet.getMaxRows() - FIRST_ROW + 1, 3).getValues();
}

function currentPage_(sheet) {
  return Number(sheet.getRange(1, TABS[sheet.getName()].page).getValue()) || 1;
}

function lastPage_(sheet) {
  var pages = data_(sheet).map(function (row) { return Number(row[0]) || 0; });
  return Math.max.apply(null, pages);
}

/** The tab in front, if it is one of the review tabs; else the newest (Pass 2). */
function review_() {
  var active = SpreadsheetApp.getActiveSheet();
  return TABS[active.getName()] ? active : SpreadsheetApp.getActive().getSheetByName('Pass 2');
}

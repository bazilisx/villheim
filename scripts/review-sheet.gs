/**
 * Villheim design review sheet: shows one gallery page at a time on the Review tab.
 *
 * Install once: in the sheet, Extensions > Apps Script, replace everything there with this file, save.
 * No authorisation is needed: it only uses simple triggers (onEdit, onOpen).
 *
 * Top bar of the Review tab:
 *   E1  tick box: back one page
 *   F1  the page shown; type a number to jump to that page
 *   G1  tick box: next page
 * Menu "Villheim review": next page, back one page, next page with blanks, show every page.
 */

var SHEET = 'Review';
var FIRST_ROW = 3; // rows 1 and 2 are the top bar and the headings

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Villheim review')
    .addItem('Next page', 'nextPage')
    .addItem('Back one page', 'previousPage')
    .addItem('Next page with blanks', 'nextBlankPage')
    .addItem('Show every page', 'showAll')
    .addToUi();
}

function onEdit(e) {
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET || e.range.getRow() !== 1) {
    return;
  }

  var column = e.range.getColumn();
  var page = currentPage_(sheet);
  if (column === 5 && e.value === 'TRUE') {
    e.range.setValue(false);
    showPage_(sheet, Math.max(1, page - 1));
  } else if (column === 7 && e.value === 'TRUE') {
    e.range.setValue(false);
    showPage_(sheet, Math.min(lastPage_(sheet), page + 1));
  } else if (column === 6) {
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

/** The first page, from the start, that still has a design with no verdict. */
function nextBlankPage() {
  var sheet = review_();
  var rows = data_(sheet);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] !== '' && rows[i][2] === '') {
      showPage_(sheet, Number(rows[i][0]));
      return;
    }
  }

  SpreadsheetApp.getActive().toast('Every design has a verdict.');
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

  sheet.getRange('F1').setValue(page);
  sheet.getRange(FIRST_ROW, 3).activate();
}

function data_(sheet) {
  return sheet.getRange(FIRST_ROW, 1, sheet.getMaxRows() - FIRST_ROW + 1, 3).getValues();
}

function currentPage_(sheet) {
  return Number(sheet.getRange('F1').getValue()) || 1;
}

function lastPage_(sheet) {
  var pages = data_(sheet).map(function (row) { return Number(row[0]) || 0; });
  return Math.max.apply(null, pages);
}

function review_() {
  return SpreadsheetApp.getActive().getSheetByName(SHEET);
}

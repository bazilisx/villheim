/**
 * Villheim design review sheet: shows one gallery page at a time on the Review and Pass 2 tabs.
 *
 * Install once: in the sheet, Extensions > Apps Script, replace everything there with this file, save.
 * No authorisation is needed: it only uses simple triggers (onEdit, onOpen).
 *
 * Top bar of each tab: a tick box to go back one page, the page shown (type a number to jump), a tick box for the
 * next page. Review: E1, F1, G1. Pass 2: D1, E1, F1.
 * Menu "Villheim review": next page, back one page, show every page.
 *
 * Sorting from the game (design review phases A and B): the game sends every sort choice here. Set up once:
 * Deploy > New deployment > type Web app, Execute as: Me, Who has access: Anyone, Deploy, allow access, copy the web
 * app address and type 'vh sort url <address>' in the game console. The address is the only key, so keep it to
 * yourself. After pasting a new version of this file: Deploy > Manage deployments > edit > Version: New version.
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

/**
 * Sort choices from the game: {"rows":[{"number":283,"name":"WoodHouse8","type":"Work","subtype":"Farming"}]}.
 * Each row is found by its design number in the "No." column of the Pass 2 tab; only the fields sent are written.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActive().getSheetByName('Pass 2');
    var headings = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
    var column = {};
    headings.forEach(function (name, i) { column[String(name).trim()] = i + 1; });
    var numbers = sheet.getRange(FIRST_ROW, column['No.'], sheet.getMaxRows() - FIRST_ROW + 1, 1).getValues()
      .map(function (row) { return Number(row[0]); });
    var fields = { type: 'Type', subtype: 'Subtype', biome: 'Biome', base: 'Base ID', s: 's' };
    var written = 0;
    var missing = [];
    (body.rows || []).forEach(function (row) {
      var index = numbers.indexOf(Number(row.number));
      if (index < 0) {
        missing.push(row.number);
        return;
      }

      Object.keys(fields).forEach(function (key) {
        if (row[key] !== undefined && column[fields[key]]) {
          sheet.getRange(FIRST_ROW + index, column[fields[key]]).setValue(row[key]);
        }
      });
      written++;
    });

    var slots = writeSlots_(body.slots || []);
    return answer_({ ok: true, written: written, missing: missing, slots: slots });
  } catch (error) {
    return answer_({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Slotting board saves: one row per saved file in the Slots tab (made if missing), found by file name and replaced.
 * Each row comes as a list: File, Base ID, s, d, Biome, Subtype, No., Name, Match, Pieces, Saved at.
 * A list with only the file name removes that file's row.
 */
function writeSlots_(rows) {
  if (!rows.length) {
    return 0;
  }

  var book = SpreadsheetApp.getActive();
  var sheet = book.getSheetByName('Slots');
  var headings = ['File', 'Base ID', 's', 'd', 'Biome', 'Subtype', 'No.', 'Name', 'Match', 'Pieces', 'Saved at'];
  if (!sheet) {
    sheet = book.insertSheet('Slots');
    sheet.getRange(1, 1, 1, headings.length).setValues([headings]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var last = sheet.getLastRow();
  var files = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  rows.forEach(function (row) {
    // A row with only a file name: that save was undone or forgotten, so its row goes.
    if (row.length === 1) {
      var gone = files.indexOf(String(row[0]));
      if (gone >= 0) {
        sheet.deleteRow(gone + 2);
        files.splice(gone, 1);
      }
      return;
    }

    var values = headings.map(function (h, i) { return row[i] === undefined ? '' : String(row[i]); });
    var index = files.indexOf(values[0]);
    if (index >= 0) {
      sheet.getRange(index + 2, 1, 1, headings.length).setValues([values]);
    } else {
      sheet.appendRow(values);
      files.push(values[0]);
    }
  });
  return rows.length;
}

/** Opening the web app address in a browser shows this, to check the deployment works. */
function doGet() {
  return answer_({ ok: true, sheet: SpreadsheetApp.getActive().getName() });
}

function answer_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

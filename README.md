# >_ Word Trainer

A German→English vocabulary trainer that runs on your own machine, reads its words from a spreadsheet you control, and looks like a 1980s CRT terminal.

I built it to learn German. I kept collecting words in an Excel file (one sheet per topic, each word with its translation and an example sentence from wherever I'd found it) and wanted something that would drill me on that file instead of yet another app with someone else's word lists. The spreadsheet stays the source of truth; this is just a trainer pointed at it.

It is a personal learning tool, not a product: no accounts, no sync, no telemetry. It runs on `localhost` and keeps your progress in a plain JSON file next to the code.

## Getting started

Requires Node.js 18+.

```bash
git clone https://github.com/domonkoshaffner/word-trainer.git
cd word-trainer
npm install
npm start
```

Then open **http://localhost:3000**. The repo ships with my own vocabulary (168 words across four topic sheets) in `data/flashcards.xlsx`, so there's something real to practise with straight away.

## Your vocabulary file

Replace `data/flashcards.xlsx` with your own workbook, made in Excel, Numbers, LibreOffice or Google Sheets (File → Download → .xlsx). Nothing in the code refers to specific words.

- **One sheet per topic.** The sheet name becomes the set name in the app.
- **Three columns, read by position, with no header row:** A is the German word, B the English translation, C an optional German example sentence.

| A | B | C |
|---|---|---|
| der Bahnhof, -e | train station | Der Bahnhof liegt direkt im Zentrum. |
| umsteigen | to change trains | In München müssen wir einmal umsteigen. |

A few tips:

- Rows missing column A or B are skipped, so you can keep notes-to-self in the file.
- Column C appears as a hint and feeds the Unscramble exercise, which needs at least three words.
- Include the article and plural ending (`die Fahrkarte, -n`) to have them drilled; `der`/`die`/`das` are colour-coded.
- Typed answers are matched exactly, ignoring only capitalisation, so write column B the way you want to type it. Slashes work for alternatives (`maybe / perhaps`).
- Don't use the `|` character in columns A or B; it's used internally.
- Reload the page after editing the spreadsheet.

## What's in it

Pick a set and a batch of words (10 by default), then an exercise:

- **True or False**, **Multiple Choice**, **Word Matching**, **Unscramble** (rebuild the example sentence) and **Typing** (with ä/ö/ü/ß buttons).
- **Both directions:** German→English or English→German, switchable mid-session.
- **Mistakes batch:** words you get wrong come back until you've answered them correctly five times.
- **Test mode:** a timed, graded test across all exercise types, unlocked once you've completed every exercise in every batch of the set.
- **Blitz mode:** the prompt blurs after a second or two, so you have to commit to an answer.
- **Green phosphor or amber:** two terminal palettes, with falling code and CRT scanlines.

Progress is saved in `progress.txt` (gitignored) and a few preferences in `localStorage`. Delete the file to start over, or use the per-set reset buttons.

## How it's built

- **`server.js`:** a small Express server that reads the workbook with [SheetJS](https://sheetjs.com/), serves `index.html`, and saves progress through a small JSON API. It only accepts connections from your own machine.
- **`index.html`:** the whole frontend (markup, CSS and JavaScript) in one file, with no framework and no build step. To add an exercise type, start at the `ExerciseTypes` registry; the comment above it documents the interface.

## License

ISC. See [LICENSE](LICENSE). The fonts, [VT323](https://fonts.google.com/specimen/VT323) and [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) (SIL Open Font License 1.1), load from Google Fonts at runtime and are not redistributed here.

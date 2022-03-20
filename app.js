
const fs = require('fs/promises');
const exec = require('await-exec');
const { argv, exit } = require('process');

const basic_note_name = "KaTeX and Markdown Basic"
const cloze_note_name = "KaTeX and Markdown Cloze"

const log = (type, message) => {
    console.log(`[${type}] ${message}`);
}

const getRawMarkdownNotes = async (filepath) => {
    log('info', `Reading from file ${filepath}...`);
    const notes = await fs.readFile(filepath);

    return await notes.toString();
};

const splitRawNotesToCards = (rawNotes) => {
    const cardRegex = /-\s.*\n(\s{4}-\s.*$\n)+/gm
    const cardsArray = rawNotes.match(cardRegex);

    return cardsArray;
};

const getCardType = (rawCardBullets) => rawCardBullets.length == 2 ? basic_note_name : cloze_note_name;

const parseRawCard = (rawCard) => {
    const rawCardBullets = rawCard
        .split('\n')
        .filter(bullet => bullet != '')
        .map(bullet => bullet.trim())
        .map(bullet => bullet.slice(2));

    const cardType = getCardType(rawCardBullets);
    const question = rawCardBullets[0];
    const answers = rawCardBullets.splice(1);

    const parsedCard = {
        cardType,
        question,
        answers
    };

    return parsedCard;
};

const parseRawNotesIntoPages = (rawNotes) => {
    log('info', `Parsing notes...`);
    const cardsArray = splitRawNotesToCards(rawNotes);

    let parsedNotesPages = [];
    let parsedNotes = [];
    let page = 0;
    let maxPerPage = 5;
    for (var rawCard of cardsArray) {
        var parsedCard = parseRawCard(rawCard);
        parsedNotes.push(parsedCard);
        if (parsedNotes.length == maxPerPage) {
            parsedNotesPages.push(parsedNotes);
            parsedNotes = [];
        }
    }

    return parsedNotesPages;
}

const createBasicFields = (question, answers) => {
    return {
        Front: question,
        Back: answers[0]
    };
}

const createClozeFields = (question, answers) => {
    return {
        Text: `**${question}**\n${answers.filter(bullet => bullet != '').map(bullet => `- ${bullet}`).join('\n')}`
    };
};

const createAnkiFields = (note) => {
    return note.cardType == basic_note_name 
            ? createBasicFields(note.question, note.answers)
            : createClozeFields(note.question, note.answers);
};

const convertNotesToAnki = (deckname, notes) => {
    let ankiNotes = [];

    for (var note of notes) {
        var ankiNote = {
            deckName: deckname,
            modelName: note.cardType,
            fields: createAnkiFields(note)
        };

        ankiNotes.push(ankiNote);
    }

    return ankiNotes;
}

const createRequestData = (deckname, notes) => {
    const ankiNotes = convertNotesToAnki(deckname, notes);

    const requestObject = {
        action: 'addNotes',
        version: 6,
        params: {
            notes: ankiNotes
        }
    };

    return JSON.stringify(requestObject);
}

const convertRawNotesToUnix = async (filename) => {
    log('info', `Converting ${filename} to Unix file format...`)
    const conversionCommand= `dos2unix -u md-notes/${filename}`
    let { stdout, stderr } = await exec(conversionCommand);
};

const postNotes = async (filename, deckname) => {
    await convertRawNotesToUnix(filename);
    const rawNotes = await getRawMarkdownNotes(`md-notes/${filename}`);
    const notesPages = parseRawNotesIntoPages(rawNotes);
    log('info', `Number of note pages: ${notesPages.length}`);
    let page = 0;
    for (var notes of notesPages) {
        const requestData = createRequestData(deckname, notes);

        log('info', `Creating page ${page} notes in Anki...`);
        const curlRequest = `echo ${requestData} | curl -sX POST -d @- "localhost:8765"`;
        let { stdout, stderr } = await exec(curlRequest);
        if (stderr) console.log(stderr);
        if (stdout) console.log(stdout);
        page++;
    }
}

postNotes(argv[2], argv[3]);
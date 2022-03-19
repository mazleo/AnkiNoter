
const fs = require('fs/promises');
const { exec } = require('child_process');
const { argv } = require('process');

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
    const cardRegex = /-\s.*\n(\s{4}-\s.*\n*)+/g
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

const parseRawNotes = (rawNotes) => {
    log('info', `Parsing notes...`);
    const cardsArray = splitRawNotesToCards(rawNotes);
    let parsedNotes = [];

    for (var rawCard of cardsArray) {
        var parsedCard = parseRawCard(rawCard);
        parsedNotes.push(parsedCard);
    }

    return parsedNotes;
}

const createBasicFields = (question, answers) => {
    return {
        Front: question,
        Back: answers[0]
    };
}

const createClozeFields = (question, answers) => {
    return {
        Text: `**${question}**\n${answers.map(bullet => `- ${bullet}`).join('\n')}`
    };
};

const createAnkiFields = (note) => {
    return note.cardType == basic_note_name 
            ? createBasicFields(note.question, note.answers)
            : createClozeFields(note.question, note.answers);
};

const convertNotesToAnki = (deckname, notes) => {
    log('info', 'Converting parsed notes into an AnkiConnect valid JSON value...');
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

const postNotes = async (deckname) => {
    const rawNotes = await getRawMarkdownNotes('md-notes/ctci-part-1.md');
    const notes = parseRawNotes(rawNotes);
    const requestData = createRequestData(deckname, notes);

    log('info', 'Creating notes in Anki...');
    const curlRequest = `echo ${requestData} | curl -sX POST -d @- "localhost:8765"`;
    exec(curlRequest, (error, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);
    });
};

postNotes(argv[2]);
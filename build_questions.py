"""Convert the urology test .docx into site/questions.js.

Format: '#' starts a question, '+' marks a correct answer, '-' (or en/em dash)
marks a wrong one. Unprefixed lines after answers are treated as wrong answers.
Answers are normalised (capitalised, trailing punctuation removed) so that
formatting differences never hint at the correct option.
"""
import json
import re
import sys

import docx

WRONG_MARKS = '-–—'
FIXES = {
    '-alfa reduktaza fermenti aktivligining oshishi': '5-alfa reduktaza fermenti aktivligining oshishi',
    '-alfa-reduktaza fermentining tug‘ma yo‘qligi': '5-alfa-reduktaza fermentining tug‘ma yo‘qligi',
}


def clean_answer(text):
    text = re.sub(r'\s+', ' ', text).strip()
    text = FIXES.get(text, text)
    text = re.sub(r'[\s.;,:]+$', '', text)
    return text[:1].upper() + text[1:] if text else text


def parse(path):
    questions, cur = [], None
    for para in docx.Document(path).paragraphs:
        for line in para.text.replace('\xa0', ' ').split('\n'):
            line = line.strip()
            if not line:
                continue
            if line.startswith('#'):
                q = re.sub(r'^#\s*', '', line)
                q = re.sub(r'\s*\(\d+\)\s*([?.:]?)\s*$', r'\1', q)
                cur = {'q': re.sub(r'\s+', ' ', q), 'a': [], 'c': []}
                questions.append(cur)
            elif cur is None:
                continue
            elif line[0] == '+' or line[0] in WRONG_MARKS:
                cur['a'].append(clean_answer(line[1:]))
                if line[0] == '+':
                    cur['c'].append(len(cur['a']) - 1)
            elif not cur['a']:
                cur['q'] += ' ' + line
            else:
                cur['a'].append(clean_answer(line))
    return questions


def main(src, dst):
    qs = parse(src)
    skipped = [q['q'] for q in qs if not q['c']]
    qs = [q for q in qs if q['c'] and all(q['a'])]
    with open(dst, 'w', encoding='utf8') as f:
        f.write('window.QUESTIONS=' + json.dumps(qs, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{len(qs)} questions written, skipped without answer key: {skipped}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

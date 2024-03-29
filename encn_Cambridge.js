/* global api */
class encn_Cambridge {
  constructor(options) {
    this.options = options;
    this.maxexample = 2;
    this.word = '';
  }

  async displayName() {
    let locale = await api.locale();
    if (locale.indexOf('CN') != -1) return '剑桥英汉双解(简体)';
    if (locale.indexOf('TW') != -1) return '劍橋英漢雙解(簡體)';
    return 'Cambridge EN->CN Dictionary (SC)';
  }

  setOptions(options) {
    this.options = options;
    this.maxexample = options.maxexample;
  }

  async findTerm(word) {
    this.word = word;
    let promises = [this.findCambridge(word)];
    let results = await Promise.all(promises);
    return [].concat(...results).filter((x) => x);
  }

  async findCambridge(word) {
    let notes = [];
    if (!word) {
      console.log('no word');
      return notes; // return empty notes
    }

    function T(node) {
      if (!node) return '';
      else return node.innerText.trim();
    }

    let base = 'https://dictionary.cambridge.org/us/search/english/direct/?q=';
    let url = base + encodeURIComponent(word);
    let doc = '';
    try {
      let data = await api.fetch(url);
      let parser = new DOMParser();
      doc = parser.parseFromString(data, 'text/html');
    } catch (err) {
      console.error(err);
      return [];
    }

    try {
      let entries = doc.querySelectorAll('.pr .entry-body__el') || [];
      console.log('entries', entries);
      const idioms = doc.querySelectorAll('.pr.idiom-block') || [];
      console.log('idioms', idioms);
      const combinedEntriyArray = Array.from(entries).concat(
        Array.from(idioms)
      );
      for (const entry of combinedEntriyArray) {
        let definitions = [];
        let audios = [];

        let expression = T(entry.querySelector('.headword'));
        let reading = '';
        let readings = entry.querySelectorAll('.pron .ipa');
        if (!readings?.length || readings.length === 0) {
          console.log('no readings', readings);
        } else if (readings.length < 2) {
          console.log('not enough readings', readings);
        } else {
          let reading_us = T(readings[0]);
          let reading_uk = T(readings[1]);
          reading =
            reading_us || reading_uk
              ? `US[${reading_us}] UK[${reading_uk}] `
              : '';
        }
        let pos = T(entry.querySelector('.posgram'));
        pos = pos ? `<span class='pos'>${pos}</span>` : '';
        audios[0] = entry.querySelector('.uk.dpron-i source');
        audios[0] = audios[0]
          ? 'https://dictionary.cambridge.org' + audios[0].getAttribute('src')
          : '';
        //audios[0] = audios[0].replace('https', 'http');
        audios[1] = entry.querySelector('.us.dpron-i source');
        audios[1] = audios[1]
          ? 'https://dictionary.cambridge.org' + audios[1].getAttribute('src')
          : '';
        //audios[1] = audios[1].replace('https', 'http');

        let sensbodys = entry.querySelectorAll('.sense-body') || [];
        console.log('sensbodys', sensbodys);
        const phraseDiBodies = entry.querySelectorAll('.phrase-di-body') || [];
        console.log('phraseDiBodies', phraseDiBodies);
        const combinedSensbodyArray = Array.from(sensbodys).concat(
          Array.from(phraseDiBodies)
        );
        for (const sensbody of combinedSensbodyArray) {
          let sensblocks = sensbody.childNodes || [];
          for (const sensblock of sensblocks) {
            let phrasehead = '';
            let defblocks = [];
            if (
              sensblock.classList &&
              sensblock.classList.contains('phrase-block')
            ) {
              phrasehead = T(sensblock.querySelector('.phrase-title'));
              phrasehead = phrasehead
                ? `<div class="phrasehead">${phrasehead}</div>`
                : '';
              defblocks = sensblock.querySelectorAll('.def-block') || [];
            }
            if (
              sensblock.classList &&
              sensblock.classList.contains('def-block')
            ) {
              defblocks = [sensblock];
            }
            if (defblocks.length <= 0) continue;

            // make definition segement
            for (const defblock of defblocks) {
              let eng_tran = T(defblock.querySelector('.ddef_h .def'));
              let chn_tran = T(defblock.querySelector('.def-body .trans'));
              if (!eng_tran) continue;
              let definition = '';
              eng_tran = `<span class='eng_tran'>${eng_tran.replace(
                RegExp(expression, 'gi'),
                `<b>${expression}</b>`
              )}</span>`;
              chn_tran = `<span class='chn_tran'>${chn_tran}</span>`;
              let tran = `<span class='tran'>${eng_tran}${chn_tran}</span>`;
              definition += phrasehead
                ? `${phrasehead}${tran}`
                : `${pos}${tran}`;

              // make exmaple segement
              let examps = defblock.querySelectorAll('.def-body .examp') || [];
              if (examps.length > 0 && this.maxexample > 0) {
                definition += '<ul class="sents">';
                for (const [index, examp] of examps.entries()) {
                  if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                  let eng_examp = T(examp.querySelector('.eg'));
                  let chn_examp = T(examp.querySelector('.trans'));
                  definition += `<li class='sent'><span class='eng_sent'>${eng_examp.replace(
                    RegExp(expression, 'gi'),
                    `<b>${expression}</b>`
                  )}</span><span class='chn_sent'>${chn_examp}</span></li>`;
                }
                definition += '</ul>';
              }
              definition && definitions.push(definition);
            }
          }
        }
        let css = this.renderCSS();
        notes.push({
          css,
          expression,
          reading,
          definitions,
          audios,
        });
      }
      console.log('notes', notes);
      return notes;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  renderCSS() {
    let css = `
            <style>
                div.phrasehead{margin: 2px 0;font-weight: bold;}
                span.star {color: #FFBB00;}
                span.pos  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                span.tran {margin:0; padding:0;}
                span.eng_tran {margin-right:3px; padding:0;}
                span.chn_tran {color:#0d47a1;}
                ul.sents {font-size:0.8em; list-style:square inside; margin:3px 0;padding:5px;background:rgba(13,71,161,0.1); border-radius:5px;}
                li.sent  {margin:0; padding:0;}
                span.eng_sent {margin-right:5px;}
                span.chn_sent {color:#0d47a1;}
            </style>`;
    return css;
  }
}

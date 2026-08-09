/**
 * Screens: title, save slots, difficulty, pause, settings, Grown-Ups'
 * Corner (hold-gate), fossil select, world-door dialogs (§9).
 */
import { S } from '../../engine/loader';
import { C } from '../ctx';
import type { Settings } from '../../engine/save';
import { Screen, UIStack, button, el, onOff, segToggle, slider } from './widgets';
import type { WorldEntry } from '../content-types';
import { audio } from '../../engine/audio';

export interface GameFlow {
  startNewGame(slot: number, difficulty: 'explorer' | 'hero'): void;
  continueGame(slot: number): void;
  resume(): void;
  quitToTitle(): void;
  travelTo(worldId: string, fossilHintId?: string): void;
  applySettings(): void;
  readMenuLine(text: string): void;
  fossilsOwned(): number;
  exportSave(): void;
  importSave(file: File): Promise<boolean>;
}

export class Screens {
  constructor(
    public stack: UIStack,
    private flow: GameFlow,
  ) {}

  private say(text: string): void {
    this.flow.readMenuLine(text);
  }

  // ------------------------------------------------------------- title
  title(): Screen {
    const s = new Screen('screen');
    const logo = el('div', 'title-logo');
    logo.innerHTML = `<div class="big">${S('app.title')}</div><div class="sub">${S('app.tagline')}</div>`;
    s.root.appendChild(logo);
    const col = el('div', 'menu-col');
    const play = button(S('ui.play'), () => this.stack.push(this.slots()), 'btn primary big', 'btn-play');
    col.appendChild(play);
    col.appendChild(button(S('ui.settings'), () => this.stack.push(this.settings(false))));
    col.appendChild(button(S('ui.grownups'), () => this.stack.push(this.grownupsGate())));
    s.root.appendChild(col);
    s.addFocusable(play);
    s.focusables.push(...[...col.children].slice(1) as HTMLElement[]);
    s.refreshFocus();
    return s;
  }

  // ------------------------------------------------------------- slots
  slots(): Screen {
    const s = new Screen();
    s.onBack = () => this.stack.pop();
    s.root.appendChild(el('h2', '', S('ui.chooseSlot')));
    const col = el('div', 'menu-col');
    for (let i = 0; i < 3; i++) {
      const sum = C().save.slotSummary(i);
      const label = sum.exists
        ? `${S('ui.slot', { n: i + 1 })} · ${sum.name} — ${S('ui.fossilCount', { n: sum.fossils ?? 0 })}`
        : `${S('ui.slot', { n: i + 1 })} · ${S('ui.empty')}`;
      const row = el('div');
      row.style.display = 'flex';
      row.style.gap = '10px';
      const b = button(
        label,
        () => {
          if (sum.exists) this.flow.continueGame(i);
          else this.stack.push(this.difficulty(i));
        },
        'btn' + (sum.exists ? ' primary' : ''),
        `slot-${i}`,
      );
      b.style.flex = '1';
      row.appendChild(b);
      s.addFocusable(b);
      if (sum.exists) {
        const erase = button('🗑', () => {
          this.confirm(S('ui.eraseConfirm'), () => {
            C().save.erase(i);
            this.stack.replace(this.slots());
          });
        });
        row.appendChild(erase);
        s.addFocusable(erase);
      }
      col.appendChild(row);
    }
    // import save
    const importBtn = button(S('ui.import'), () => {
      const inp = el('input') as HTMLInputElement;
      inp.type = 'file';
      inp.accept = '.json';
      inp.addEventListener('change', async () => {
        const f = inp.files?.[0];
        if (f && (await this.flow.importSave(f))) this.stack.replace(this.slots());
        else this.toastBad();
      });
      inp.click();
    });
    col.appendChild(importBtn);
    s.addFocusable(importBtn);
    const back = button(S('ui.back'), () => this.stack.pop());
    col.appendChild(back);
    s.addFocusable(back);
    s.root.appendChild(col);
    s.refreshFocus();
    this.say(S('ui.chooseSlot'));
    return s;
  }

  private toastBad(): void {
    audio.play('incorrect');
  }

  difficulty(slot: number): Screen {
    const s = new Screen();
    s.onBack = () => this.stack.pop();
    s.root.appendChild(el('h2', '', S('ui.chooseDifficulty')));
    const col = el('div', 'menu-col');
    const mk = (mode: 'explorer' | 'hero', testid: string) => {
      const wrap = el('div', 'panel');
      wrap.style.textAlign = 'center';
      const b = button(
        mode === 'explorer' ? `🧭 ${S('ui.difficulty.explorer')}` : `🛡️ ${S('ui.difficulty.hero')}`,
        () => this.flow.startNewGame(slot, mode),
        'btn primary big',
        testid,
      );
      wrap.appendChild(b);
      wrap.appendChild(el('p', '', mode === 'explorer' ? S('ui.difficulty.explorerDesc') : S('ui.difficulty.heroDesc')));
      col.appendChild(wrap);
      s.addFocusable(b);
    };
    mk('explorer', 'btn-difficulty-explorer');
    mk('hero', 'btn-difficulty-hero');
    s.root.appendChild(col);
    s.refreshFocus();
    this.say(S('ui.chooseDifficulty'));
    return s;
  }

  confirm(text: string, onYes: () => void): void {
    const s = new Screen();
    s.onBack = () => this.stack.pop();
    const p = el('div', 'panel');
    p.style.textAlign = 'center';
    p.appendChild(el('h3', '', text));
    const row = el('div', 'answer-row');
    const yes = button(S('ui.yes'), () => {
      this.stack.pop();
      onYes();
    }, 'btn primary');
    const no = button(S('ui.no'), () => this.stack.pop());
    row.appendChild(yes);
    row.appendChild(no);
    p.appendChild(row);
    s.root.appendChild(p);
    s.addFocusable(yes);
    s.addFocusable(no);
    s.focusIndex = 1;
    s.refreshFocus();
    this.stack.push(s);
  }

  // ------------------------------------------------------------- pause
  pause(): Screen {
    const s = new Screen();
    s.onBack = () => this.flow.resume();
    s.root.appendChild(el('h2', '', S('ui.paused')));
    const col = el('div', 'menu-col');
    const resume = button(S('ui.resume'), () => this.flow.resume(), 'btn primary big', 'btn-resume');
    col.appendChild(resume);
    col.appendChild(button(S('ui.controls'), () => this.stack.push(this.controls())));
    col.appendChild(button(S('ui.settings'), () => this.stack.push(this.settings(true))));
    col.appendChild(button(S('ui.grownups'), () => this.stack.push(this.grownupsGate())));
    col.appendChild(button(S('ui.saveQuit'), () => this.flow.quitToTitle()));
    s.root.appendChild(col);
    for (const c of [...col.children]) s.addFocusable(c as HTMLElement);
    s.refreshFocus();
    return s;
  }

  controls(): Screen {
    const s = new Screen();
    s.onBack = () => this.stack.pop();
    const p = el('div', 'panel');
    p.appendChild(el('h3', '', S('ui.controls')));
    const list = el('div');
    list.style.textAlign = 'left';
    list.style.fontSize = '1.1rem';
    list.style.lineHeight = '1.9';
    for (const key of ['move', 'jump', 'spin', 'stomp', 'chomp', 'roar', 'interact', 'camera', 'zoom', 'recentre', 'hint', 'pause']) {
      list.appendChild(el('div', '', S(`controls.${key}`)));
    }
    p.appendChild(list);
    const back = button(S('ui.back'), () => this.stack.pop());
    p.appendChild(back);
    s.root.appendChild(p);
    s.addFocusable(back);
    s.refreshFocus();
    return s;
  }

  // ---------------------------------------------------------- settings
  settings(inGame: boolean): Screen {
    const s = new Screen();
    s.onBack = () => this.stack.pop();
    const st = C().save.settings;
    const p = el('div', 'panel');
    p.appendChild(el('h3', '', S('settings.title')));
    const grid = el('div', 'settings-grid');
    const add = (label: string, control: HTMLElement) => {
      grid.appendChild(el('label', '', label));
      grid.appendChild(control);
      if (control instanceof HTMLInputElement || control.classList.contains('seg-toggle')) {
        for (const b of control.querySelectorAll('button')) s.addFocusable(b as HTMLElement);
        if (control instanceof HTMLInputElement) s.addFocusable(control);
      }
    };
    const apply = () => {
      C().save.saveSettings();
      this.flow.applySettings();
    };
    const head = (t: string) => {
      const h = el('div', '', t);
      h.style.fontSize = '1.3rem';
      h.style.marginTop = '8px';
      h.style.color = 'var(--accent)';
      grid.appendChild(h);
      grid.appendChild(el('div'));
    };

    head(`🔊 ${S('settings.sound')}`);
    add(S('settings.musicVol'), slider(st.musicVol, 0, 1, 0.05, (v) => ((st.musicVol = v), apply())));
    add(S('settings.sfxVol'), slider(st.sfxVol, 0, 1, 0.05, (v) => ((st.sfxVol = v), apply())));
    add(S('settings.voiceVol'), slider(st.voiceVol, 0, 1, 0.05, (v) => ((st.voiceVol = v), apply())));
    add(S('settings.voiceOn'), onOff(st.voiceOn, (v) => ((st.voiceOn = v), apply()), S('ui.yes'), S('ui.no')));
    add(S('settings.speechRate'), slider(st.speechRate, 0.7, 1.5, 0.1, (v) => ((st.speechRate = v), apply())));
    add(S('settings.readMenus'), onOff(st.readMenus, (v) => ((st.readMenus = v), apply()), S('ui.yes'), S('ui.no')));

    head(`👀 ${S('settings.look')}`);
    add(
      S('settings.subtitleSize'),
      segToggle(
        [
          { value: 'small', label: S('settings.small') },
          { value: 'medium', label: S('settings.medium') },
          { value: 'large', label: S('settings.large') },
        ],
        st.subtitleSize,
        (v) => ((st.subtitleSize = v), apply()),
      ),
    );
    add(S('settings.dyslexiaFont'), onOff(st.dyslexiaFont, (v) => ((st.dyslexiaFont = v), apply()), S('ui.yes'), S('ui.no')));
    add(S('settings.reduceShake'), onOff(st.reduceShake, (v) => ((st.reduceShake = v), apply()), S('ui.yes'), S('ui.no')));
    add(S('settings.reduceFlash'), onOff(st.reduceFlash, (v) => ((st.reduceFlash = v), apply()), S('ui.yes'), S('ui.no')));
    add(S('settings.colourAssist'), onOff(st.colourAssist, (v) => ((st.colourAssist = v), apply()), S('ui.yes'), S('ui.no')));
    add(
      S('settings.quality'),
      segToggle(
        [
          { value: 'auto', label: S('ui.quality.auto') },
          { value: 'low', label: S('ui.quality.low') },
          { value: 'medium', label: S('ui.quality.medium') },
          { value: 'high', label: S('ui.quality.high') },
        ],
        st.quality,
        (v) => ((st.quality = v), apply()),
      ),
    );

    head(`🎥 ${S('settings.camera')}`);
    add(S('settings.cameraSens'), slider(st.cameraSensitivity, 0.4, 2, 0.1, (v) => ((st.cameraSensitivity = v), apply())));
    add(S('settings.invertX'), onOff(st.invertCameraX, (v) => ((st.invertCameraX = v), apply()), S('ui.yes'), S('ui.no')));
    add(S('settings.invertY'), onOff(st.invertCameraY, (v) => ((st.invertCameraY = v), apply()), S('ui.yes'), S('ui.no')));
    add(S('settings.holdToggles'), onOff(st.holdToggles, (v) => ((st.holdToggles = v), apply()), S('ui.yes'), S('ui.no')));

    if (inGame && C().save.current) {
      head(`🎮 ${S('settings.game')}`);
      add(
        S('settings.difficulty'),
        segToggle(
          [
            { value: 'explorer', label: S('ui.difficulty.explorer') },
            { value: 'hero', label: S('ui.difficulty.hero') },
          ],
          C().save.current!.difficulty,
          (v) => {
            C().save.current!.difficulty = v;
            C().save.persist();
            this.flow.applySettings();
          },
        ),
      );
    }

    p.appendChild(grid);
    const back = button(S('ui.back'), () => this.stack.pop(), 'btn primary');
    p.appendChild(back);
    s.root.appendChild(p);
    s.addFocusable(back);
    s.refreshFocus();
    return s;
  }

  // ------------------------------------------------- grown-ups' corner
  grownupsGate(): Screen {
    const s = new Screen();
    s.onBack = () => this.stack.pop();
    const p = el('div', 'panel hold-gate');
    p.style.textAlign = 'center';
    p.appendChild(el('h3', '', S('grownups.title')));
    p.appendChild(el('p', '', S('grownups.hold')));
    const bar = el('div', 'bar');
    const fill = el('div', 'fill');
    bar.appendChild(fill);
    const hold = button(S('grownups.holdBtn'), () => {}, 'btn primary big');
    let t = 0;
    let timer: number | null = null;
    const start = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        t += 0.05;
        fill.style.width = `${Math.min(100, (t / 3) * 100)}%`;
        if (t >= 3) {
          stop();
          this.stack.replace(this.grownups());
        }
      }, 50);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
      t = 0;
      fill.style.width = '0%';
    };
    hold.addEventListener('pointerdown', start);
    hold.addEventListener('pointerup', stop);
    hold.addEventListener('pointerleave', stop);
    hold.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') start();
    });
    hold.addEventListener('keyup', stop);
    p.appendChild(hold);
    p.appendChild(bar);
    const back = button(S('ui.back'), () => this.stack.pop());
    back.style.marginTop = '14px';
    p.appendChild(back);
    s.root.appendChild(p);
    s.addFocusable(hold);
    s.addFocusable(back);
    s.refreshFocus();
    return s;
  }

  grownups(): Screen {
    const s = new Screen();
    s.onBack = () => this.stack.pop();
    const save = C().save.current;
    const p = el('div', 'panel');
    p.style.maxWidth = 'min(760px, 94vw)';
    p.appendChild(el('h3', '', S('grownups.title')));
    p.appendChild(el('p', '', S('grownups.intro')));
    if (save) {
      const h = Math.floor(save.playtimeMs / 3600000);
      const m = Math.floor((save.playtimeMs % 3600000) / 60000);
      p.appendChild(el('p', '', S('grownups.playtime', { h, m })));
      p.appendChild(
        el('p', '', S('grownups.difficulty', { mode: save.difficulty === 'explorer' ? S('ui.difficulty.explorer') : S('ui.difficulty.hero') })),
      );
      const topics = el('div', 'gu-topics');
      for (const [topicId, pack] of C().content.topics) {
        const prog = save.mastery[topicId];
        const name = S(pack.topicNameKey);
        const row = el('div', 'gu-topic');
        const stars = prog ? starCount(prog.xp) : 0;
        let summary: string;
        if (!prog || prog.correct + prog.wrong === 0) summary = S('grownups.unseen', { topic: name });
        else if (stars >= 2) summary = S('grownups.confident', { topic: name });
        else if (prog.wrong > prog.correct) summary = S('grownups.tricky', { topic: name, place: placeFor(topicId) });
        else summary = S('grownups.practising', { topic: name });
        row.appendChild(el('div', '', summary));
        row.appendChild(el('div', '', '⭐'.repeat(stars) + '☆'.repeat(3 - stars)));
        topics.appendChild(row);
      }
      p.appendChild(topics);
      const exportBtn = button(S('ui.export'), () => this.flow.exportSave());
      p.appendChild(exportBtn);
      s.addFocusable(exportBtn);
    } else {
      p.appendChild(el('p', '', S('grownups.noData')));
    }
    const back = button(S('ui.back'), () => this.stack.pop(), 'btn primary');
    back.style.marginLeft = '10px';
    p.appendChild(back);
    s.root.appendChild(p);
    s.addFocusable(back);
    s.refreshFocus();
    return s;
  }

  // ------------------------------------------------------ fossil select
  fossilSelect(world: WorldEntry, onPicked: (fossilId: string | null) => void, hintSpeak: (fossilId: string) => void): Screen {
    const s = new Screen();
    s.onBack = () => {
      this.stack.pop();
      onPicked(null);
    };
    s.root.appendChild(el('h2', '', S('ui.fossilSelectTitle', { world: S(world.name) })));
    const list = el('div', 'fossil-list');
    const save = C().save.current;
    const level = world.level ? C().content.levels.get(world.level) : undefined;
    const fossils = level?.fossils ?? [];
    const KIND_ICON: Record<string, string> = {
      task: '🧪',
      secret: '🐾',
      platforming: '🏃',
      arena: '⚔️',
      boss: '👑',
      garden: '🌱',
      bonus: '🟡',
    };
    const rows: { id: string }[] = [...fossils.map((f) => ({ id: f.id }))];
    if (level?.bonusFossilId) rows.push({ id: level.bonusFossilId });
    for (const f of rows) {
      const got = save?.fossils.includes(f.id) ?? false;
      const def = fossils.find((x) => x.id === f.id);
      const row = el('div', 'fossil-row' + (got ? ' got' : ''));
      row.dataset.testid = `fossil-${f.id}`;
      const icon = el('div', 'ficon', got ? '⭐' : (KIND_ICON[def?.kind ?? 'bonus'] ?? '⭐'));
      const body = el('div');
      body.appendChild(el('div', '', S(def ? def.nameKey : `fossil.${f.id}.name`)));
      const hint = el('div', 'fhint', S(def ? def.hintKey : `fossil.${f.id}.hint`));
      body.appendChild(hint);
      row.appendChild(icon);
      row.appendChild(body);
      row.addEventListener('click', () => {
        this.stack.pop();
        onPicked(f.id);
      });
      row.addEventListener('mouseenter', () => hintSpeak(f.id));
      list.appendChild(row);
      s.addFocusable(row);
    }
    s.root.appendChild(list);
    const goBtn = button(S('ui.travel'), () => {
      this.stack.pop();
      onPicked(fossils[0]?.id ?? null);
    }, 'btn primary big', 'btn-travel');
    const stay = button(S('ui.stayHere'), () => {
      this.stack.pop();
      onPicked(null);
    });
    const row = el('div', 'answer-row');
    row.appendChild(goBtn);
    row.appendChild(stay);
    s.root.appendChild(row);
    s.addFocusable(goBtn);
    s.addFocusable(stay);
    s.refreshFocus();
    return s;
  }

  comingSoon(world: WorldEntry): void {
    const s = new Screen();
    s.onBack = () => this.stack.pop();
    const p = el('div', 'panel');
    p.style.textAlign = 'center';
    p.style.maxWidth = '520px';
    p.appendChild(el('h3', '', `${world.icon ?? ''} ${S(world.name)} — ${S('ui.comingSoonTitle')}`));
    p.appendChild(el('p', '', S('ui.comingSoonBody')));
    const ok = button(S('ui.ok'), () => this.stack.pop(), 'btn primary');
    p.appendChild(ok);
    s.root.appendChild(p);
    s.addFocusable(ok);
    s.refreshFocus();
    this.stack.push(s);
    this.say(S('ui.comingSoonBody'));
  }
}

function starCount(xp: number): number {
  const thresholds = C().content.config.education.masteryStarXp;
  let stars = 0;
  for (const t of thresholds) if (xp >= t) stars++;
  return stars;
}

function placeFor(topicId: string): string {
  // find a world whose levels host a task with this topic
  for (const [, level] of C().content.levels) {
    for (const t of level.tasks ?? []) {
      const task = C().content.tasks.get(t.ref);
      if (task?.topicId === topicId) return S(`place.${level.id}`);
    }
  }
  return S('place.hub');
}

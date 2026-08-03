"""
Adphone デモ発表スライド PPTX
・最小フォントサイズ 20pt
・白黒のみ・影なし
・はみ出す場合は内容を省略
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.oxml.ns import qn
from lxml import etree

prs = Presentation()
prs.slide_width  = Inches(13.33)
prs.slide_height = Inches(7.5)

W = prs.slide_width
H = prs.slide_height

# ── 白黒カラー ──────────────────────────────────────────
C_BLACK = RGBColor(0x00, 0x00, 0x00)
C_DARK  = RGBColor(0x1A, 0x1A, 0x1A)
C_BODY  = RGBColor(0x33, 0x33, 0x33)
C_SUB   = RGBColor(0x55, 0x55, 0x55)
C_MID   = RGBColor(0x88, 0x88, 0x88)
C_LINE  = RGBColor(0xBB, 0xBB, 0xBB)
C_CARD  = RGBColor(0xEE, 0xEE, 0xEE)
C_CARD2 = RGBColor(0xE0, 0xE0, 0xE0)
C_WHITE = RGBColor(0xFF, 0xFF, 0xFF)

blank = prs.slide_layouts[6]

MG       = Inches(0.55)
BODY_TOP = Inches(1.12)
BODY_BOT = H - Inches(0.25)
BODY_H   = BODY_BOT - BODY_TOP
R_END    = W - MG
BODY_W   = R_END - MG
LH       = Inches(0.52)   # 20pt 行高さ
D        = Inches(0.11)   # 箇条書きドット

def add_slide():
    return prs.slides.add_slide(blank)

def no_shadow(shape):
    try:
        sp = shape._element
        spPr = sp.find(qn('p:spPr'))
        if spPr is None:
            return
        for eff in spPr.findall(qn('a:effectLst')):
            spPr.remove(eff)
        etree.SubElement(spPr, qn('a:effectLst'))
    except Exception:
        pass

def tb(slide, l, t, w, h, text, size, bold=False, color=None,
       align=PP_ALIGN.LEFT, italic=False):
    box = slide.shapes.add_textbox(l, t, w, h)
    tf  = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size  = Pt(size)
    run.font.bold  = bold
    run.font.italic = italic
    run.font.color.rgb = color if color else C_BODY
    no_shadow(box)
    return box

def rect(slide, l, t, w, h, fill=None, lc=None, lw=Pt(1)):
    shp = slide.shapes.add_shape(1, l, t, w, h)
    if fill:
        shp.fill.solid(); shp.fill.fore_color.rgb = fill
    else:
        shp.fill.background()
    if lc:
        shp.line.color.rgb = lc; shp.line.width = lw
    else:
        shp.line.fill.background()
    no_shadow(shp)
    return shp

def hline(slide, t, l=None, r=None):
    l = l if l is not None else MG
    r = r if r is not None else R_END
    ln = slide.shapes.add_connector(1, l, t, r, t)
    ln.line.color.rgb = C_LINE
    ln.line.width = Pt(1.2)

def oval(slide, l, t, d, fill=C_DARK):
    shp = slide.shapes.add_shape(9, l, t, d, d)
    shp.fill.solid(); shp.fill.fore_color.rgb = fill
    shp.line.fill.background()
    no_shadow(shp)
    return shp

def header(slide, name):
    tb(slide, MG, Inches(0.28), BODY_W, Inches(0.72),
       name, size=36, bold=True, color=C_DARK)
    hline(slide, Inches(1.04))

def ph(slide, l, t, w, h, label, note=''):
    rect(slide, l, t, w, h, fill=C_CARD, lc=C_LINE, lw=Pt(1.5))
    mid = t + h / 2
    tb(slide, l, mid - Inches(0.35), w, Inches(0.36),
       '[写真]  ' + label, size=20, bold=True, color=C_MID, align=PP_ALIGN.CENTER)
    if note:
        tb(slide, l, mid + Inches(0.1), w, Inches(0.45),
           note, size=20, color=RGBColor(0xAA, 0xAA, 0xAA), align=PP_ALIGN.CENTER)

def bullets(slide, l, t, w, items, size=20, lh=LH):
    y = t
    for item in items:
        oval(slide, l, y + lh * 0.38, D)
        tb(slide, l + Inches(0.24), y, w - Inches(0.24), lh,
           item, size=size, color=C_SUB)
        y += lh
    return y

def accent_label(slide, l, t, w, text, size=22):
    bar = slide.shapes.add_shape(1, l, t + Inches(0.07), Inches(0.05), Inches(0.26))
    bar.fill.solid(); bar.fill.fore_color.rgb = C_DARK
    bar.line.fill.background(); no_shadow(bar)
    tb(slide, l + Inches(0.13), t, w, Inches(0.4),
       text, size=size, bold=True, color=C_DARK)

def left_band_box(slide, l, t, w, h, band_fill, bg_fill, text, size=20):
    rect(slide, l, t, Inches(0.07), h, fill=band_fill)
    rect(slide, l + Inches(0.07), t, w - Inches(0.07), h, fill=bg_fill)
    tb(slide, l + Inches(0.22), t + Inches(0.14), w - Inches(0.3), h - Inches(0.18),
       text, size=size, color=C_DARK)

def step_card(slide, l, t, w, h, num, title, body):
    D2 = Inches(0.48)
    oval(slide, l, t + (h - D2) / 2, D2, fill=C_DARK)
    tb(slide, l, t + (h - D2) / 2, D2, D2,
       num, size=20, bold=True, color=C_WHITE, align=PP_ALIGN.CENTER)
    bx = l + D2 + Inches(0.14)
    bw = w - D2 - Inches(0.14)
    rect(slide, bx, t, bw, h, fill=C_CARD)
    tb(slide, bx + Inches(0.2), t + Inches(0.1), bw - Inches(0.25), Inches(0.44),
       title, size=22, bold=True, color=C_DARK)
    tb(slide, bx + Inches(0.2), t + Inches(0.56), bw - Inches(0.25), h - Inches(0.64),
       body, size=20, color=C_SUB)


# ════════════════════════════════════════════════════════
# Slide 1 — タイトル
# ════════════════════════════════════════════════════════
s1 = add_slide()
LW1 = Inches(7.3)
RX1 = MG + LW1 + Inches(0.35)

tb(s1, MG, Inches(0.9), LW1, Inches(1.8),
   'Adphone', size=80, bold=True, color=C_DARK)
rect(s1, MG, Inches(2.65), Inches(1.6), Inches(0.1), fill=C_DARK)
tb(s1, MG, Inches(2.9), LW1, Inches(0.55),
   '災害情報の信頼度を可視化するアプリ', size=22, color=C_SUB)
hline(s1, Inches(3.62), l=MG, r=MG + LW1)
bullets(s1, MG, Inches(3.82), LW1, [
    'クラウドソーシング＋暗号署名で信頼度を自動スコアリング',
    '信頼度スコアと連動したマップ上の災害可視化',
    'A* による災害回避ルーティング・完全オフライン対応',
], size=20, lh=Inches(0.56))
ph(s1, RX1, Inches(0.9), R_END - RX1, Inches(6.0),
   'アプリ画面（フィード＋マップ）', '起動直後の2画面を横並びで')


# ════════════════════════════════════════════════════════
# Slide 2 — 課題
# ════════════════════════════════════════════════════════
s2 = add_slide()
header(s2, '課題')
LW2 = Inches(7.0)
RX2 = MG + LW2 + Inches(0.35)

PBH = Inches(1.05)
left_band_box(s2, MG, BODY_TOP, LW2, PBH, C_DARK, C_CARD,
              '大規模災害時、SNS には真偽不明の情報が殺到する。\n公式情報とデマが同じタイムラインに混在する。', size=20)

bullets(s2, MG, BODY_TOP + PBH + Inches(0.22), LW2, [
    '能登半島地震（2024）で誤情報が救助隊を誤誘導',
    '公式情報と一般投稿の区別が視覚的にできない',
    '古い情報と最新情報が時系列で混在し危険性を誤認する',
], size=20, lh=LH)

SY2 = BODY_TOP + PBH + Inches(0.22) + LH * 3 + Inches(0.25)
left_band_box(s2, MG, SY2, LW2, Inches(1.0), C_BLACK, C_CARD2,
              'Adphone は全投稿に信頼度スコア（0〜100%）を自動付与し、信頼できる情報をひと目で判断できるようにする。', size=20)

ph(s2, RX2, BODY_TOP, R_END - RX2, BODY_H,
   'SNS 上の災害情報の例', 'デマと公式情報が混在する画像')


# ════════════════════════════════════════════════════════
# Slide 3 — フィード機能
# ════════════════════════════════════════════════════════
s3 = add_slide()
header(s3, 'フィード機能')

BADGE_H3 = Inches(1.55)
BW3 = (BODY_W - Inches(0.3)) / 4
bx3 = MG
for (title, cond, bg, fg) in [
    ('公式',     '公式機関署名 ＋ ★★★',   C_DARK,  C_WHITE),
    ('確認済',   '★★★  または  ★★＋公式', C_CARD2, C_DARK),
    ('一部確認', '★★  /  複数目撃あり',    C_CARD,  C_DARK),
    ('未確認',   '★  /  単独報告のみ',     C_WHITE, C_DARK),
]:
    lc = C_LINE if bg == C_WHITE else None
    rect(s3, bx3, BODY_TOP, BW3, BADGE_H3, fill=bg, lc=lc, lw=Pt(1.2))
    tb(s3, bx3 + Inches(0.16), BODY_TOP + Inches(0.14), BW3 - Inches(0.2), Inches(0.5),
       title, size=24, bold=True, color=fg)
    tb(s3, bx3 + Inches(0.16), BODY_TOP + Inches(0.68), BW3 - Inches(0.2), Inches(0.76),
       cond, size=20, color=fg)
    bx3 += BW3 + Inches(0.1)

PH_Y3 = BODY_TOP + BADGE_H3 + Inches(0.18)
PH_H3 = BODY_BOT - PH_Y3
PW3   = Inches(7.6)
RX3   = MG + PW3 + Inches(0.3)
RW3   = R_END - RX3

ph(s3, MG, PH_Y3, PW3, PH_H3,
   'フィード画面のスクリーンショット',
   '公式（92%）と未確認（35%）の投稿が並ぶ状態')

accent_label(s3, RX3, PH_Y3, RW3, 'フィードで見える情報', size=22)
bullets(s3, RX3, PH_Y3 + Inches(0.48), RW3, [
    '信頼度バッジ＋パーセント表示',
    '署名チェーン（誰がいつ確認したか）',
    '投稿者の信頼スコア 0〜100pt',
    '同意 / 否定でスコアをリアルタイム更新',
    '半径内の確認端末数を投稿に表示',
], size=20, lh=LH)


# ════════════════════════════════════════════════════════
# Slide 4 — 信頼度スコアリング
# ════════════════════════════════════════════════════════
s4 = add_slide()
header(s4, '信頼度スコアリング')
LW4 = Inches(7.0)
RX4 = MG + LW4 + Inches(0.35)

# 数式ボックス（ユーザーの変更を反映）
FH4 = Inches(1.55)
rect(s4, MG, BODY_TOP, Inches(0.07), FH4, fill=C_DARK)
rect(s4, MG + Inches(0.07), BODY_TOP, LW4 - Inches(0.07), FH4, fill=C_CARD)
tb(s4, MG + Inches(0.22), BODY_TOP + Inches(0.1), LW4 - Inches(0.3), Inches(0.48),
   'score  =  Σ ( decay(t)  ×  ユーザー信頼度スコアによる重み )',
   size=22, bold=True, color=C_DARK)
tb(s4, MG + Inches(0.22), BODY_TOP + Inches(0.62), LW4 - Inches(0.3), Inches(0.8),
   'decay = e^(−ln2/halfLife × elapsed)\n昼（6〜22時）半減期 1時間  ／  夜（22〜6時）半減期 3時間',
   size=20, color=C_SUB)

# テーブル
TY4  = BODY_TOP + FH4 + Inches(0.22)
TRH  = Inches(0.52)
COL1 = Inches(4.6)
COL2 = LW4 - COL1

rect(s4, MG, TY4, LW4, TRH, fill=C_DARK)
tb(s4, MG + Inches(0.12), TY4 + Inches(0.08), COL1, TRH,
   '発行者', size=20, bold=True, color=C_WHITE)
tb(s4, MG + COL1 + Inches(0.12), TY4 + Inches(0.08), COL2, TRH,
   '重み', size=20, bold=True, color=C_WHITE)

for i, (c1, c2, b2) in enumerate([
    ('公式機関（気象庁・消防など）',       '5.0  固定', True),
    ('一般ユーザー（trust 0〜100pt）',     '0.5 〜 2.0', False),
]):
    ry = TY4 + TRH * (i + 1)
    rect(s4, MG, ry, LW4, TRH, fill=C_CARD if i % 2 == 0 else C_WHITE, lc=C_LINE, lw=Pt(0.5))
    tb(s4, MG + Inches(0.12), ry + Inches(0.08), COL1 - Inches(0.12), TRH,
       c1, size=20, color=C_DARK)
    tb(s4, MG + COL1 + Inches(0.12), ry + Inches(0.08), COL2 - Inches(0.12), TRH,
       c2, size=20, bold=b2, color=C_DARK)

UY4 = TY4 + TRH * 3 + Inches(0.28)
hline(s4, UY4, l=MG, r=MG + LW4)
accent_label(s4, MG, UY4 + Inches(0.16), LW4, 'ユーザー信頼スコアの変動', size=22)
bullets(s4, MG, UY4 + Inches(0.6), LW4, [
    '同意（現地一致）: +3pt　　否定: −5pt　　初期値 50pt',
    '1投稿につき1票・Firestoreトランザクションで二重投票防止',
    'オフライン中はSQLiteにキュー、復帰時に自動一括同期',
], size=20, lh=LH)

ph(s4, RX4, BODY_TOP, R_END - RX4, BODY_H,
   '署名チェーン 展開画面',
   '気象庁・消防署・防災士の\n署名が並んだ状態')


# ════════════════════════════════════════════════════════
# Slide 5 — マップ機能
# ════════════════════════════════════════════════════════
s5 = add_slide()
header(s5, 'マップ機能')
PW5 = Inches(7.8)
RX5 = MG + PW5 + Inches(0.3)
RW5 = R_END - RX5

ph(s5, MG, BODY_TOP, PW5, BODY_H,
   'マップ画面のスクリーンショット',
   '渋谷周辺の洪水・火災・道路閉塞マーカーが\n色分けされて表示された状態')

# 凡例：ユーザーの2列スタイルを再現
accent_label(s5, RX5, BODY_TOP, RW5, 'マーカーの色  =  災害カテゴリ', size=22)

LEG5 = [
    ('青',     '浸水 / 洪水'),
    ('水色',   '津波'),
    ('赤',     '火災'),
    ('紫',     '建物倒壊'),
    ('グレー', '道路閉塞'),
    ('茶',     '土砂崩れ'),
    ('橙',     '負傷者'),
]
HW5 = Inches(1.1)   # 色名列幅
ly5 = BODY_TOP + Inches(0.5)
for cname, cat in LEG5:
    tb(s5, RX5,          ly5, HW5,       Inches(0.46), cname, size=20, bold=True, color=C_DARK)
    tb(s5, RX5 + HW5,    ly5, RW5 - HW5, Inches(0.46), cat,   size=20, color=C_SUB)
    ly5 += Inches(0.48)

hline(s5, ly5 + Inches(0.06), l=RX5, r=R_END)
bullets(s5, RX5, ly5 + Inches(0.2), RW5, [
    'ポップアップに★・目撃者数・公式バッジを表示',
    'フィルターで災害/避難所/負傷者を個別ON/OFF',
], size=20, lh=LH)


# ════════════════════════════════════════════════════════
# Slide 6 — ルーティング
# ════════════════════════════════════════════════════════
s6 = add_slide()
header(s6, 'ルーティング')
LW6 = Inches(7.6)
RX6 = MG + LW6 + Inches(0.28)

SH6  = Inches(1.38)
GAP6 = Inches(0.1)
sy6  = BODY_TOP
for num, title, body in [
    ('1', 'Pass 1 — 安全迂回',
     '危険ゾーン（半径100m＋マージン30m）のエッジを除去して A* を実行'),
    ('2', 'Pass 2 — 避難所カスケード',
     '目的地不到達なら最大8候補の避難所に順次 A* を試行'),
    ('3', 'Pass 3 — ペナルティ付き',
     '危険エッジのコストを50倍にし、グラフが非連結でも必ず経路を返す'),
]:
    step_card(s6, MG, sy6, LW6, SH6, num, title, body)
    sy6 += SH6 + GAP6

hline(s6, sy6 + Inches(0.12), l=MG, r=MG + LW6)
bullets(s6, MG, sy6 + Inches(0.28), LW6, [
    '徒歩：高速道路・工事道路除外  /  車：歩道・階段除外でネットワークを切替',
    '危険ゾーン半径は目撃者座標の広がりから自動算出（最小50m・最大200m）',
], size=20, lh=LH)

ph(s6, RX6, BODY_TOP, R_END - RX6, BODY_H,
   'ルーティング結果',
   '「迂回中」バッジと\n距離表示（例 2.3 km）')


# ════════════════════════════════════════════════════════
# Slide 7 — オフライン対応
# ════════════════════════════════════════════════════════
s7 = add_slide()
header(s7, 'オフライン対応')
LW7 = Inches(7.6)
RX7 = MG + LW7 + Inches(0.28)

# 問題ボックス（ユーザーの変更を反映）
HBH7 = Inches(1.0)
left_band_box(s7, MG, BODY_TOP, LW7, HBH7, C_DARK, C_CARD2,
              '大規模災害時、携帯基地局は数時間〜数日間停止する。\nAdphone は通信なしですべての機能が動作する。', size=20)

# 3ボックス（情報を拡充）
OY7 = BODY_TOP + HBH7 + Inches(0.2)
OH7 = Inches(2.1)    # 内容増量のため高さを拡大
OW7 = (LW7 - Inches(0.2)) / 3
ox7 = MG

OFF_BOXES = [
    (
        '地図タイル',
        '【自動】GPS移動0.05度で周辺タイルを\nバックグラウンド取得（ズーム13〜16）\n【手動】現在表示エリアをボタン一発で\nズーム11〜16の全タイルを一括保存',
    ),
    (
        '道路 / 避難所',
        'OSM 20万件の道路ネットワークを\n端末内アセットとして内包\n59件の避難所リストも\n端末内で保持・検索可能',
    ),
    (
        '投票データ',
        'オフライン中はSQLiteに記録\n（synced=0 でキュー管理）\n通信回復時にFirestoreへ\n自動一括同期し二重投票を防止',
    ),
]
for (title, body) in OFF_BOXES:
    rect(s7, ox7, OY7, OW7, OH7, fill=C_CARD)
    tb(s7, ox7 + Inches(0.15), OY7 + Inches(0.1), OW7 - Inches(0.2), Inches(0.44),
       title, size=22, bold=True, color=C_DARK)
    tb(s7, ox7 + Inches(0.15), OY7 + Inches(0.56), OW7 - Inches(0.2), OH7 - Inches(0.64),
       body, size=20, color=C_SUB)
    ox7 += OW7 + Inches(0.1)

hline(s7, OY7 + OH7 + Inches(0.2), l=MG, r=MG + LW7)
bullets(s7, MG, OY7 + OH7 + Inches(0.38), LW7, [
    'BLE / LoRa メッシュ：基地局なしでデバイス間の情報を中継',
    'オフライン認証：Firebase 不可時は端末固有UUIDをIDとして使用',
], size=20, lh=LH)

ph(s7, RX7, BODY_TOP, R_END - RX7, BODY_H,
   'オフラインモード時の画面',
   '機内モードでマップと\nルートが動作している状態')


# ════════════════════════════════════════════════════════
# Slide 8 — まとめ
# ════════════════════════════════════════════════════════
s8 = add_slide()
header(s8, 'まとめ')

CLOSE_H = Inches(1.0)
GAP_ROW = Inches(0.18)
GH8 = (BODY_H - CLOSE_H - GAP_ROW) / 2
GW8 = (BODY_W - Inches(0.3)) / 3

SUMMARY8 = [
    ('信頼度の多段階可視化',  'バッジ 4 段階＋%表示＋星評価\n誰でも一瞬で情報の質を判断'),
    ('署名チェーンの透明性',  '誰がいつ確認したか全員分を展開\nEd25519 署名でなりすまし防止'),
    ('時間減衰スコアリング', '昼 1h / 夜 3h 半減期の指数減衰\n古い情報を自動で押し下げ'),
    ('災害回避ルーティング', 'A*＋危険ゾーン 50〜200m\n3段階フォールバック付き安全経路'),
    ('完全オフライン動作',   '自動/手動タイル取得＋SQLite\n通信断でも全機能が動作'),
    ('オンデバイス AI',      'Gemma 3n（int4 量子化）を端末推論\nテキスト・画像解析がクラウドなし'),
]

gx8 = MG
gy8 = BODY_TOP
for i, (title, body) in enumerate(SUMMARY8):
    if i == 3:
        gx8 = MG
        gy8 = BODY_TOP + GH8 + GAP_ROW
    rect(s8, gx8, gy8, Inches(0.07), GH8, fill=C_DARK)
    rect(s8, gx8 + Inches(0.07), gy8, GW8 - Inches(0.07), GH8, fill=C_CARD)
    tb(s8, gx8 + Inches(0.22), gy8 + Inches(0.14), GW8 - Inches(0.3), Inches(0.46),
       title, size=22, bold=True, color=C_DARK)
    tb(s8, gx8 + Inches(0.22), gy8 + Inches(0.62), GW8 - Inches(0.3), GH8 - Inches(0.7),
       body, size=20, color=C_SUB)
    gx8 += GW8 + Inches(0.15)

CY8 = BODY_TOP + GH8 * 2 + GAP_ROW + Inches(0.18)
hline(s8, CY8)
tb(s8, MG, CY8 + Inches(0.18), BODY_W, Inches(0.52),
   'クラウドソーシング  ×  暗号署名  ×  機械的スコアリング',
   size=24, bold=True, color=C_DARK, align=PP_ALIGN.CENTER)
tb(s8, MG, CY8 + Inches(0.74), BODY_W, Inches(0.38),
   '混乱する災害現場でも、信頼できる情報を届ける',
   size=20, color=C_SUB, align=PP_ALIGN.CENTER)


# ── 保存 ────────────────────────────────────────────────
out = 'slides_demo.pptx'
prs.save(out)
print(f'Saved: {out}  ({len(prs.slides)} slides)')

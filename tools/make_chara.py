# キャラ画像をWeb用に変換する。
#   python tools/make_chara.py
#
# 素材はCM動画作成パイプラインのキャラ表情セット（ステッカー調・白フチつき・透過済み）。
# 暗い画面の上でも白フチのおかげで浮くので、この用途に一番合う。
# キャスティングの cutout.png は «正本の姿» だが表情が1つしかないので使っていない。
from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
# 素材はこのリポジトリの外（同じ作業場に並ぶCM動画作成パイプライン）にある。
# 場所が違うときは環境変数 CHARA_SRC で渡す。
SRC = os.environ.get(
    'CHARA_SRC',
    os.path.join(os.path.dirname(REPO), '20260702_CM動画作成パイプライン', 'assets', 'characters'),
)
OUT = os.path.join(REPO, 'public')

# (フォルダ, 表情, 出力名, 高さ)
JOBS = [
    ('yokobo', 'idea',     'chara-yokobo',          400),  # ラボ紹介（ひらめき）
    ('nyabit', 'happy',    'chara-nyabbit',         400),  # ラボ紹介・クリア
    ('nyabit', 'surprise', 'chara-nyabbit-oops',    400),  # とどかなかった時
]

os.makedirs(OUT, exist_ok=True)
for folder, face, name, height in JOBS:
    im = Image.open(os.path.join(SRC, folder, face + '.png')).convert('RGBA')
    im = im.crop(im.getbbox())                       # 透明な余白を落とす
    w = round(im.width * height / im.height)
    im = im.resize((w, height), Image.LANCZOS)
    path = os.path.join(OUT, name + '.webp')
    im.save(path, 'WEBP', quality=86, method=6)
    print(f'{name}: {im.size}  {round(os.path.getsize(path)/1024)} KB  ({folder}/{face})')

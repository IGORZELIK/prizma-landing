"""Пример производителя для витрины prizma.to: чугунная гриль-сковорода без бренда.

Улучшения против первого теста 26.10:
- сковорода с нуля по тексту (text-to-image), без фото товара и без таблички на ручке, куда модель
  рисовала надпись; кадры 2-6 получают картинку 1 референсом, чтобы сковорода совпадала;
- масла и сливочного масла нет ни в картинках, ни в промтах движения (на гриль-сковороде смазывают мясо);
- переворот одним непрерывным планом, без склеек внутри ролика Runway;
- финальный план со статичной камерой: «dolly out» Runway исполнял наездом, ручка уходила из кадра.

Запуск: python3 kie.py balance | img1 | imgs [имя ...] | video [имя ...]
"""
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
STATE = HERE / "urls.json"
API = "https://api.kie.ai/api/v1"
KEY = next(l.split("=", 1)[1].strip().strip("\"'") for l in open(os.path.expanduser("~/.hermes/.env"))
           if l.startswith("KIE_API_KEY="))

WORLD = ("Dark slate kitchen, black gas stove, one warm key light from the left, deep soft shadows, light smoke haze. "
         "High-end food commercial photography, photorealistic, shallow depth of field.")
PAN = ("A round matte black cast iron grill pan: raised parallel grill ribs across the whole bottom, two pouring lips, "
       "a small loop helper handle opposite a long plain black cast iron handle. No plate, no label, no logo, "
       "no lettering anywhere on the pan.")
SAME = "The pan is exactly the pan in Picture 1, same shape and proportions, no logo, no lettering."
TAIL = "The pan is the sharpest thing in the frame. No text, no watermark, no oil or butter in the pan."

IMAGES = {
    # Кадр 1: стейк уже смазан и посолен, держится щипцами над пустой горячей сковородой
    "img1": ("Low-angle close-up at the height of the pan rim. The pan sits on a gas burner with blue flames under it, "
             "the dry grill ribs are smoking hot. Steel kitchen tongs hold a thick raw ribeye steak, seasoned with "
             f"coarse salt and pepper, just above the pan, about to lay it down. {PAN} {WORLD} {TAIL}"),
    # Кадр 2: сверху, стейк лежит, края уже схватились, щипцы у края: под переворот
    "img2": ("High camera looking down at the pan at a steep 45-degree angle, the whole round pan visible on the gas "
             "burner. A thick ribeye steak lies flat on the grill ribs and sears, its edges browned, light smoke rising. "
             f"The tips of steel tongs grip the edge of the steak. {SAME} {WORLD} {TAIL}"),
    # Кадр 3: финал, сковорода целиком в кадре, нижняя треть спокойная под текст
    "img3": ("Wide three-quarter hero shot. The pan stands on a dark wooden board next to the stove, the whole pan and "
             "the whole handle inside the frame with space around them. The seared steak with dark crisp diagonal grill "
             "marks lies in the pan, a rosemary sprig on top, gentle steam. The lower third of the frame is calm dark "
             f"wood. {SAME} {WORLD} {TAIL}"),
    # Карусель и пост: тот же мир, разные сцены про свойства чугуна
    "c1": ("Moody product hero shot of the empty pan standing on a dark wooden board, seen from a 30-degree angle, "
           f"the grill ribs catching the warm light. Lots of dark empty space in the upper half. {SAME} {WORLD} "
           "No text, no watermark."),
    "c2": ("Close-up of the pan on the gas burner, heat shimmer above the empty dry grill ribs, blue flame glow "
           f"underneath, a few faint wisps of smoke. {SAME} {WORLD} No text, no watermark."),
    "c3": ("Overhead close-up of a seared ribeye steak lifted by steel tongs above the pan, showing perfect dark "
           f"diagonal grill marks, the grill ribs of the pan visible below. {SAME} {WORLD} {TAIL}"),
    "c4": ("The pan inside a dark home oven on the rack, roasted vegetables and a chicken thigh with crisp skin in it, "
           f"warm oven light. {SAME} Photorealistic food commercial photography, warm tones. No text, no watermark."),
    "c5": ("Close-up of hands with a soft cloth wiping a thin layer onto the clean empty dry pan on a wooden counter, "
           f"calm care moment, warm light. {SAME} Photorealistic, shallow depth of field. No text, no watermark."),
}

VIDEOS = {
    "v1": ("img1", "The tongs slowly lower the steak onto the hot grill ribs. The steak sizzles and smoke rises. "
                   "Locked camera, one continuous shot. Cinematic live-action food commercial."),
    "v2": ("img2", "The tongs turn the steak over in one smooth motion, revealing dark grill marks. Smoke rises. "
                   "Locked camera, one continuous shot, no cuts. Cinematic live-action food commercial."),
    # v2 не перевернул стейк (щипцы ушли, стейк лежит). Замена: от кадра c3, где стейк уже поднят
    # полосами к камере, щипцы кладут его обратно; полосы видны весь план
    "v2b": ("c3", "The tongs slowly lay the steak back down onto the hot grill ribs, the dark grill marks facing up. "
                  "Smoke rises. Locked camera, one continuous shot, no cuts. Cinematic live-action food commercial."),
    # v2b клал стейк второй раз (после v1 это повтор). Средний план: стейк лежит, щипцы приподнимают его,
    # снизу видны полосы. Подъём, а не переворот: опускание Runway исполнил, переворот провалил
    "v2c": ("img2", "The tongs lift the steak up from the pan and tilt it toward the camera, revealing dark seared "
                    "grill marks on its underside. Smoke rises. Locked camera, one continuous shot, no cuts. "
                    "Cinematic live-action food commercial."),
    "v2d": ("img2", "The tongs slowly raise one edge of the steak, showing the browned underside with dark grill "
                    "lines. Smoke curls up. Locked camera, one continuous shot, no cuts. "
                    "Cinematic live-action food commercial."),
    "v3": ("img3", "Steam rises gently from the steak. The rosemary leaves tremble slightly. "
                   "Locked camera, one continuous shot. Cinematic live-action food commercial."),
}


def call(path: str, body: dict | None = None) -> dict:
    # curl, а не urllib: у python.org-сборки на Маке нет корневых сертификатов
    args = ["curl", "-s", "-m", "60", API + path, "-H", f"Authorization: Bearer {KEY}"]
    if body:
        args += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    return json.loads(subprocess.run(args, capture_output=True, text=True, check=True).stdout)


def balance() -> float:
    return call("/chat/credit")["data"]


def state() -> dict:
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def save(name: str, value: dict) -> None:
    s = state()
    s[name] = value
    STATE.write_text(json.dumps(s, indent=1, ensure_ascii=False))


def run(name: str, body: dict) -> str:
    """Создаёт задачу, ждёт до 10 минут, скачивает результат рядом, возвращает URL."""
    r = call("/jobs/createTask", body)
    if r.get("code") != 200:
        raise RuntimeError(f"{name}: {r}")
    task = r["data"]["taskId"]
    print(f"[{name}] task={task}", flush=True)
    for _ in range(120):
        time.sleep(5)
        d = call(f"/jobs/recordInfo?taskId={task}")["data"]
        if d.get("state") == "success":
            url = json.loads(d["resultJson"])["resultUrls"][0]
            save(name, {"task": task, "url": url, "body": body})
            subprocess.run(["curl", "-s", "-o", str(HERE / (name + Path(url).suffix)), url], check=True)
            print(f"[{name}] {url}", flush=True)
            return url
        if d.get("state") == "fail":
            raise RuntimeError(f"{name}: {d.get('failMsg')}")
    raise TimeoutError(name)


def image(name: str) -> str:
    if name == "img1":
        return run(name, {"model": "gpt-image-2-5-flare-text-to-image",
                          "input": {"prompt": IMAGES[name], "aspect_ratio": "9:16", "resolution": "1K"}})
    return run(name, {"model": "gpt-image-2-5-flare-image-to-image",
                      "input": {"prompt": IMAGES[name], "aspect_ratio": "9:16", "resolution": "1K",
                                "input_urls": [state()["img1"]["url"]]}})


def video(name: str) -> str:
    src, prompt = VIDEOS[name]
    return run(name, {"model": "runway", "input": {"prompt": prompt, "image_url": state()[src]["url"],
                                                   "duration": 5, "quality": "720p", "watermark": ""}})


def main() -> None:
    cmd, args = sys.argv[1], sys.argv[2:]
    before = balance()
    print(f"баланс до: {before}")
    try:
        if cmd == "img1":
            image("img1")
        elif cmd == "imgs":
            with ThreadPoolExecutor(4) as ex:
                list(ex.map(image, args or [n for n in IMAGES if n != "img1"]))
        elif cmd == "video":
            with ThreadPoolExecutor(3) as ex:
                list(ex.map(video, args or list(VIDEOS)))
    finally:
        after = balance()
        print(f"баланс после: {after}, списано {round(before - after, 2)} кредитов (${round((before - after) * 0.005, 3)})")


if __name__ == "__main__":
    main()

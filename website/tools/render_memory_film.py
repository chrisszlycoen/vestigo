"""Render an original, silent motion-design loop. Requires Pillow and FFmpeg.

This creates procedural artwork, not AI-generated/Google Flow footage. No source
images, online services, model calls, or credentials are used.
"""
import argparse
import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


def render_frame(width, height, phase, theme='light'):
    image = Image.new('RGB', (width, height), '#20231d' if theme == 'dark' else '#f5f3ee')
    shadow = Image.new('RGBA', (width, height))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((width*.28, height*.80, width*.80, height*.91), fill=(71, 53, 33, 30))
    image.paste(shadow.filter(ImageFilter.GaussianBlur(width*.023)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(width*.023)))
    draw = ImageDraw.Draw(image)
    angle = -.22 + .45 * math.sin(phase)
    pitch = .35 + .035 * math.cos(phase)
    float_y = .055 * math.sin(phase)
    ca, sa, cp, sp = math.cos(angle), math.sin(angle), math.cos(pitch), math.sin(pitch)
    scale = min(width*.24, height*.205)

    def camera(point):
        x, y, z = point
        x, z = ca*x + sa*z, -sa*x + ca*z
        y += float_y
        return (x, cp*y - sp*z, sp*y + cp*z)

    def project(point):
        x, y, z = camera(point)
        p = 7.5 / (7.5 - z)
        return (width*.51 + scale*x*p, height*.48 - scale*y*p)

    faces = []

    def face(points, color, edge=None):
        depth = sum(camera(p)[2] for p in points) / len(points)
        faces.append((depth, [project(p) for p in points], color, edge))

    for index, y in enumerate([-.99, -.04, .91]):
        bob = .035 * math.sin(phase + index*.5)
        a, b, t = 1.22, .73, .115
        v = [(-a,y+bob,-b),(a,y+bob,-b),(a,y+bob,b),(-a,y+bob,b),
             (-a,y+bob-t,-b),(a,y+bob-t,-b),(a,y+bob-t,b),(-a,y+bob-t,b)]
        face([v[i] for i in [4,5,6,7]], '#272923')
        face([v[i] for i in [0,1,5,4]], '#292b25')
        face([v[i] for i in [1,2,6,5]], '#35372f')
        face([v[i] for i in [2,3,7,6]], '#35372e')
        face([v[i] for i in [3,0,4,7]], '#252720')
        face([v[i] for i in [0,1,2,3]], '#515647' if theme == 'dark' else '#414238', '#616353' if theme == 'dark' else '#515144')

    segments = 260
    turns = 1.75
    half_band = .235
    radius_x, radius_z = 1.75, 1.08
    start = -.3

    def ribbon(t, band, outer=0):
        theta = start + t * turns * math.tau
        return ((radius_x + outer)*math.cos(theta), -1.40 + t*3.10 + band,
                (radius_z + outer)*math.sin(theta))

    for i in range(segments):
        t0, t1 = i/segments, (i+1)/segments
        theta = start + (t0+t1)*.5*turns*math.tau
        light = .55 + .25 * math.cos(theta + angle - .8)
        # A highlight travels along the connected ribbon once per loop.
        pulse = max(0, math.cos(theta - phase*2))**18
        light = min(1, light + pulse*.22)
        color = (int(177+68*light), int(49+72*light), int(18+38*light))
        inside = (int(163+67*light), int(45+53*light), int(16+29*light))
        points = [ribbon(t0,-half_band), ribbon(t1,-half_band), ribbon(t1,half_band), ribbon(t0,half_band)]
        face(points, color)
        face([ribbon(t0,-half_band,-.025),ribbon(t1,-half_band,-.025),ribbon(t1,half_band,-.025),ribbon(t0,half_band,-.025)], inside)
        face([ribbon(t0,half_band),ribbon(t1,half_band),ribbon(t1,half_band,-.025),ribbon(t0,half_band,-.025)], (249,151,83))
    for _, points, color, edge in sorted(faces, key=lambda item:item[0]):
        draw.polygon(points, fill=color)
        if edge:
            draw.line(points+[points[0]], fill=edge, width=1)
    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--poster', required=True)
    parser.add_argument('--width', type=int, default=1280)
    parser.add_argument('--height', type=int, default=960)
    parser.add_argument('--seconds', type=int, default=8)
    parser.add_argument('--theme', choices=['light','dark'], default='light')
    args = parser.parse_args()
    output, poster = Path(args.output), Path(args.poster)
    output.parent.mkdir(parents=True, exist_ok=True)
    poster.parent.mkdir(parents=True, exist_ok=True)
    fps = 30
    command = ['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24',
               '-s',f'{args.width}x{args.height}','-r',str(fps),'-i','-','-an','-c:v','libx264',
               '-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(output)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        for frame in range(fps*args.seconds):
            image = render_frame(args.width,args.height,frame/(fps*args.seconds)*math.tau,args.theme)
            if frame == 0:
                image.save(poster, quality=93)
            process.stdin.write(image.tobytes())
            if frame % fps == 0:
                print(f'Rendering motion film: {frame//fps+1}/{args.seconds}s',flush=True)
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise SystemExit('FFmpeg could not encode the film.')
    print(f'Created {output}: {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()

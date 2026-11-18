"""Génère supabase/migrations/..._seed_exercises.sql depuis free-exercise-db (domaine public).

Usage : python3 scripts/build_exercise_seed.py chemin/vers/exercises.json
Source : https://github.com/yuhonas/free-exercise-db (dist/exercises.json)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from exercises_fr import FR, CATEGORY, MUSCLE, EQUIPMENT, LEVEL  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'supabase', 'migrations')
PARTS = 3  # découpé pour pouvoir coller chaque fichier dans l'éditeur SQL de Supabase


def q(v):
    if v is None:
        return 'null'
    return "'" + str(v).replace("'", "''") + "'"


def arr(items):
    if not items:
        return 'null'
    return 'array[' + ','.join(q(i) for i in items) + ']::text[]'


def main(path):
    data = json.load(open(path, encoding='utf-8'))
    missing = [k for k in FR if k not in {d['name'] for d in data}]
    if missing:
        raise SystemExit('Traductions sans correspondance : %s' % missing)
    rows = []
    for d in data:
        fr = FR.get(d['name'])
        muscles = ', '.join(MUSCLE.get(m, m) for m in d.get('primaryMuscles') or [])
        secondary = ', '.join(MUSCLE.get(m, m) for m in d.get('secondaryMuscles') or [])
        category = CATEGORY.get(d.get('category'), d.get('category'))
        if category == 'Force' and d.get('force') == 'static' and 'abdominals' in (d.get('primaryMuscles') or []):
            category = 'Gainage'
        rows.append('(' + ','.join([
            q(d['id']), q(fr[0] if fr else d['name']), q(d['name']), q(category), q(muscles or None),
            q(secondary or None), q(EQUIPMENT.get(d.get('equipment'), d.get('equipment'))),
            q(LEVEL.get(d.get('level'), d.get('level'))), q(fr[1] if fr else None),
            arr(d.get('instructions')), arr(d.get('images')), 'true' if fr else 'false',
        ]) + ')')
    size = -(-len(rows) // PARTS)
    for i in range(PARTS):
        chunk = rows[i * size:(i + 1) * size]
        out = os.path.join(OUT_DIR, '20261118000%d00_seed_exercises_%d.sql' % (i + 1, i + 1))
        with open(out, 'w', encoding='utf-8') as f:
            f.write('-- Base d\'exercices pré-remplie, partie %d/%d (%d exercices) – source : free-exercise-db, domaine public.\n' % (i + 1, PARTS, len(chunk)))
            f.write('-- Images servies depuis le CDN jsDelivr (voir src/lib/exercises.js).\n')
            f.write('insert into public.exercises (slug, name, name_en, category, muscles, secondary_muscles, '
                    'equipment, level, description, instructions, images, featured) values\n')
            f.write(',\n'.join(chunk))
            f.write('\non conflict (slug) do update set name = excluded.name, name_en = excluded.name_en, '
                    'category = excluded.category, muscles = excluded.muscles, secondary_muscles = excluded.secondary_muscles, '
                    'equipment = excluded.equipment, level = excluded.level, description = excluded.description, '
                    'instructions = excluded.instructions, images = excluded.images, featured = excluded.featured;\n')
    print('%d exercices écrits (%d traduits) en %d fichiers' % (len(rows), sum(1 for d in data if d['name'] in FR), PARTS))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'exercises.json')

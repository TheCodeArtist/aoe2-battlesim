import sys
import json
import os
from pathlib import Path

# Add vendor path to sys.path so we can import analysis modules
current_dir = Path(__file__).parent
vendor_path = current_dir.parent.parent / "vendor" / "aoe2-unit-analyzer"
sys.path.append(str(vendor_path))

try:
    import analysis.config as _analysis_config

    # Prefer the committed extracted_data snapshot in this repo so CI doesn't
    # need the submodule's gitignored files or the game's .dat file.
    _committed_data = current_dir.parent.parent / "worker" / "data" / "extracted_data"
    if _committed_data.exists():
        _analysis_config.OUTPUT_DIR = _committed_data

    from analysis.unit_analyzer import UnitAnalyzer
    from analysis.config import (
    IMPERIAL_UNITS, CASTLE_UNITS, FEUDAL_UNITS,
    UNIQUE_UNITS,
    IMPERIAL_AGE, CASTLE_AGE, FEUDAL_AGE,
)
except ImportError as e:
    print(f"Error importing analysis modules: {e}")
    print(f"Vendor path: {vendor_path}")
    sys.exit(1)

def slugify(text):
    return text.lower().replace(" ", "_").replace("-", "_")


def build_unit_data(analyzer, civ_name, unit_config, age):
    """Run UnitAnalyzer for one (civ, unit_config, age) combination.

    Returns (key, unit_data) or None if the civ does not have the unit.
    """
    result = analyzer.calculate_unit_stats_for_civ(civ_name, unit_config, age)
    if not result['has_unit']:
        return None
    stats = result['stats']
    if not stats:
        return None

    civ_slug = slugify(civ_name)
    key = f"{civ_slug}_{slugify(result['unit_name'])}"

    raw_unit = analyzer.get_unit(result['unit_id'])
    blast_width  = raw_unit.get('blast_width', 0)
    blast_damage = raw_unit.get('blast_damage', 0)
    blast_level  = raw_unit.get('blast_attack_level', 0)

    unit_data = {
        'name':      f"{civ_name} {result['unit_name']}",
        'hp':        stats.hp,
        'matk':      0,
        'patk':      0,
        'marm':      stats.melee_armor,
        'parm':      stats.pierce_armor,
        'range':     stats.range,
        'reload':    stats.reload_time,
        'speed':     stats.speed,
        'attacks':   stats.attacks,
        'armors':    stats.armors,
        'cost': {
            'food':  stats.cost_food,
            'wood':  stats.cost_wood,
            'gold':  stats.cost_gold,
            'stone': stats.cost_stone,
        },
        'trainTime':  stats.train_time,
        'accuracy':   stats.accuracy,
        'frameDelay': stats.attack_delay,
        'bonuses':    result['applied_bonuses'],
        'blastWidth':  blast_width,
        'blastDamage': blast_damage,
        'blastLevel':  blast_level,
    }

    if 3 in stats.attacks:
        unit_data['patk'] = stats.attack
    else:
        unit_data['matk'] = stats.attack

    return key, unit_data


def main():
    print('Initializing UnitAnalyzer...')
    analyzer = UnitAnalyzer()

    output_data = {}

    print(f'Processing {len(analyzer.civs)} civilizations...')

    for civ in analyzer.civs:
        civ_name = civ['name']
        civ_slug = slugify(civ_name)

        # 1. Feudal Age standard units
        for unit_config in FEUDAL_UNITS.values():
            entry = build_unit_data(analyzer, civ_name, unit_config, FEUDAL_AGE)
            if entry:
                output_data.setdefault(entry[0], entry[1])

        # 2. Castle Age standard units
        for unit_config in CASTLE_UNITS.values():
            entry = build_unit_data(analyzer, civ_name, unit_config, CASTLE_AGE)
            if entry:
                output_data.setdefault(entry[0], entry[1])

        # 3. Imperial Age standard units (highest priority — overwrites older entries)
        for unit_config in IMPERIAL_UNITS.values():
            entry = build_unit_data(analyzer, civ_name, unit_config, IMPERIAL_AGE)
            if entry:
                output_data[entry[0]] = entry[1]

        # 4. Unique Units (Elite, Imperial Age)
        if civ_name in UNIQUE_UNITS:
            for u_config in UNIQUE_UNITS[civ_name]:
                result = analyzer.calculate_unique_unit_stats(
                    civ_name, u_config, IMPERIAL_AGE, elite=True
                )
                if not result['has_unit']:
                    continue
                stats = result['stats']
                if not stats:
                    continue

                elite_name = u_config.get('elite_name', f"Elite {u_config['display_name']}")
                key = f"{civ_slug}_{slugify(elite_name)}"

                raw_unit = analyzer.get_unit(result['unit_id'])
                unit_data = {
                    'name':      f"{civ_name} {elite_name}",
                    'hp':        stats.hp,
                    'matk':      0,
                    'patk':      0,
                    'marm':      stats.melee_armor,
                    'parm':      stats.pierce_armor,
                    'range':     stats.range,
                    'reload':    stats.reload_time,
                    'speed':     stats.speed,
                    'attacks':   stats.attacks,
                    'armors':    stats.armors,
                    'cost': {
                        'food':  stats.cost_food,
                        'wood':  stats.cost_wood,
                        'gold':  stats.cost_gold,
                        'stone': stats.cost_stone,
                    },
                    'trainTime':  stats.train_time,
                    'accuracy':   stats.accuracy,
                    'frameDelay': stats.attack_delay,
                    'bonuses':    result['applied_bonuses'],
                    'blastWidth':  raw_unit.get('blast_width', 0),
                    'blastDamage': raw_unit.get('blast_damage', 0),
                    'blastLevel':  raw_unit.get('blast_attack_level', 0),
                }
                if 3 in stats.attacks:
                    unit_data['patk'] = stats.attack
                else:
                    unit_data['matk'] = stats.attack

                output_data[key] = unit_data

    output_path = current_dir.parent / 'src' / 'generated' / 'units_v2.js'
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f'Writing {len(output_data)} units to {output_path}...')
    with open(output_path, 'w') as f:
        f.write('export const units = ')
        json.dump(output_data, f, indent=2)
        f.write(';\n')

    print('Done.')

if __name__ == "__main__":
    main()

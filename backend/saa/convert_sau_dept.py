import pandas as pd
import json
import sys

def convert_sau_dept(input_path, output_path):
    """Convert departmental SAU Excel data to JSON (years 2016-2024)."""
    df = pd.read_excel(input_path, sheet_name='TER', header=None)

    # Row 5 is the header: LIB_REG2, LIB_DEP, LIB_SAA, SURF_2010, ..., SURF_2024
    header = df.iloc[5].tolist()
    df = df.iloc[6:].copy()
    df.columns = header

    # Filter to SAU rows only
    sau_label = '28 - SURFACE AGRICOLE UTILISÉE DES EXPLOITATIONS (21 + 26 + 27)'
    df = df[df['LIB_SAA'] == sau_label].copy()

    # Year columns (2016-2024)
    years = list(range(2016, 2025))
    year_cols = [f'SURF_{y}' for y in years]

    departments = []
    national_by_year = {str(y): 0.0 for y in years}

    for _, row in df.iterrows():
        dep_raw = str(row['LIB_DEP']).strip()
        # Extract code and name: "077 - Seine-et-Marne" -> code="77", name="Seine-et-Marne"
        parts = dep_raw.split(' - ', 1)
        if len(parts) != 2:
            continue
        code = parts[0].strip()
        # Strip leading zero from 3-digit numeric codes like "077" -> "77"
        # Keep 3-digit DOM codes (971, 972, etc.) and Corsica (02A, 02B -> 2A, 2B)
        if len(code) == 3 and code.isdigit() and not code.startswith('97'):
            code = code.lstrip('0').zfill(2)
        elif code in ('02A', '02B'):
            code = code[1:]  # "02A" -> "2A", "02B" -> "2B"
        name = parts[1].strip()

        sau_by_year = {}
        for y, col in zip(years, year_cols):
            val = pd.to_numeric(row[col], errors='coerce')
            if pd.notna(val):
                sau_by_year[str(y)] = round(float(val), 2)
                national_by_year[str(y)] += float(val)

        if sau_by_year:
            departments.append({
                'code': code,
                'name': name,
                'sau_by_year': sau_by_year
            })

    # Round national totals
    for y in national_by_year:
        national_by_year[y] = round(national_by_year[y], 2)

    data = {
        'metadata': {
            'source': 'Agreste - Statistique Agricole Annuelle (SAA) 2010-2024',
            'description': 'Surface Agricole Utilisée (SAU) des exploitations par département, de 2016 à 2024',
            'url': 'https://agreste.agriculture.gouv.fr/',
            'years': years,
            'unit': 'hectares',
            'note': 'Départements métropolitains et DOM'
        },
        'national': {
            'sau_by_year': national_by_year
        },
        'departments': departments
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Converted {len(departments)} departments")
    print(f"   Output: {output_path}")

if __name__ == '__main__':
    input_file = 'SAA_2010-2024-définitives_donnees-DepartementalesetRegionales/SAA_2010-2024_définitives_donnees_departementales.xlsx'
    output_file = 'sau_by_department_year.json'
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    convert_sau_dept(input_file, output_file)

import pandas as pd
import json
import sys

def clean_class_name(name):
    """Normalize SAU class names."""
    if pd.isna(name) or name == 'Total':
        return name
    name = str(name).strip()
    # Normalize formats
    mapping = {
        '[0,20 ha)': '[0,20)',
        '[0,20)': '[0,20)',
        '[20,50 ha)': '[20,50)',
        '[20,50)': '[20,50)',
        '[50,100 ha)': '[50,100)',
        '[50,100)': '[50,100)',
        '[100,200 ha)': '[100,200)',
        '[100,200)': '[100,200)',
        '[200 ha ou plus': '[200+)',
        '[200 ou plus': '[200+)',
    }
    return mapping.get(name, name)

def parse_national(df):
    """Parse FRANCE or FRMETRO sheet."""
    # Skip header row, use row 0 as column names
    df.columns = ['classe_sau', 'nb_exploitations', 'sau']
    df = df.iloc[1:7].copy()  # Rows 1-6 contain data
    df['classe_sau'] = df['classe_sau'].apply(clean_class_name)
    df['nb_exploitations'] = pd.to_numeric(df['nb_exploitations'], errors='coerce')
    df['sau'] = pd.to_numeric(df['sau'], errors='coerce')
    
    result = {"by_class": {}}
    for _, row in df.iterrows():
        cls = row['classe_sau']
        nb = row['nb_exploitations']
        sau = row['sau']
        if pd.isna(nb) or pd.isna(sau):
            continue
        if cls == 'Total':
            result['total'] = {
                'nb_exploitations': int(nb),
                'sau': round(sau, 2)
            }
        else:
            result['by_class'][cls] = {
                'nb_exploitations': int(nb),
                'sau': round(sau, 2)
            }
    return result

def parse_regions(df):
    """Parse REGION(avec DOM) sheet."""
    df.columns = ['code', 'name', 'classe_sau', 'nb_exploitations', 'sau']
    df = df.iloc[1:].copy()  # Skip header row
    df = df.dropna(subset=['code'])
    df['classe_sau'] = df['classe_sau'].apply(clean_class_name)
    df['nb_exploitations'] = pd.to_numeric(df['nb_exploitations'], errors='coerce')
    df['sau'] = pd.to_numeric(df['sau'], errors='coerce')
    
    regions = {}
    for _, row in df.iterrows():
        code = str(row['code']).zfill(2)
        if code not in regions:
            regions[code] = {
                'code': code,
                'name': row['name'],
                'by_class': {}
            }
        cls = row['classe_sau']
        nb = row['nb_exploitations']
        sau = row['sau']
        if pd.isna(nb) or pd.isna(sau):
            continue
        if cls == 'Total':
            regions[code]['total'] = {
                'nb_exploitations': int(nb),
                'sau': round(sau, 2)
            }
        elif pd.notna(cls):
            regions[code]['by_class'][cls] = {
                'nb_exploitations': int(nb),
                'sau': round(sau, 2)
            }
    
    return list(regions.values())

def parse_departments(df):
    """Parse DEP sheet."""
    df.columns = ['region_name', 'code', 'classe_sau', 'nb_exploitations', 'sau']
    df = df.iloc[1:].copy()  # Skip header row
    df = df.dropna(subset=['code'])
    df['classe_sau'] = df['classe_sau'].apply(clean_class_name)
    df['nb_exploitations'] = pd.to_numeric(df['nb_exploitations'], errors='coerce')
    df['sau'] = pd.to_numeric(df['sau'], errors='coerce')
    
    departments = {}
    for _, row in df.iterrows():
        code = str(row['code']).zfill(2)
        if code not in departments:
            departments[code] = {
                'code': code,
                'region_name': row['region_name'],
                'by_class': {}
            }
        cls = row['classe_sau']
        nb = row['nb_exploitations']
        sau = row['sau']
        if pd.isna(nb) or pd.isna(sau):
            continue
        if cls == 'Total':
            departments[code]['total'] = {
                'nb_exploitations': int(nb),
                'sau': round(sau, 2)
            }
        elif pd.notna(cls):
            departments[code]['by_class'][cls] = {
                'nb_exploitations': int(nb),
                'sau': round(sau, 2)
            }
    
    return list(departments.values())

def convert_excel_to_json(input_path, output_path):
    """Main conversion function."""
    xlsx = pd.ExcelFile(input_path)
    
    # Parse each sheet
    france_df = pd.read_excel(xlsx, sheet_name='FRANCE')
    regions_df = pd.read_excel(xlsx, sheet_name='REGION(avec DOM)')
    deps_df = pd.read_excel(xlsx, sheet_name='DEP')
    
    data = {
        'metadata': {
            'source': 'Agreste - Recensement Agricole 2020',
            'description': "Nombre d'exploitations agricoles et SAU selon classe de SAU",
            'url': 'https://agreste.agriculture.gouv.fr/',
            'sau_classes': ['[0,20)', '[20,50)', '[50,100)', '[100,200)', '[200+)'],
            'indicators': {
                'nb_exploitations': "Nombre d'exploitations",
                'sau': 'Superficie Agricole Utilisée (hectares)'
            }
        },
        'national': parse_national(france_df),
        'regions': parse_regions(regions_df),
        'departments': parse_departments(deps_df)
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Print summary
    print("✅ Converted successfully!")
    print(f"   - National: {data['national']['total']['nb_exploitations']:,} exploitations")
    print(f"   - Regions: {len(data['regions'])}")
    print(f"   - Departments: {len(data['departments'])}")
    print(f"   - Output: {output_path}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        input_file = 'RA2020_001_TranchesSAU.xlsx'
        output_file = 'ra2020.json'
    else:
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) > 2 else 'ra2020.json'
    
    convert_excel_to_json(input_file, output_file)
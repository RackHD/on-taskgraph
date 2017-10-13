def main():
    import json
    # Python module names vary depending on nxos version
    try:
        from cli import cli
    except:
        from cisco import cli
    data = {}

    try:
        data['startup-config'] = cli('show startup-config')
        data['running-config'] = cli('show running-config')
    except:
        pass

    return data

def main():
    import json
    # Python module names vary depending on nxos version
    try:
        from cli import clid
    except:
        from cisco import clid
    data = {}

    try:
        # get the version in json form in a temporary string so we can manipulate it
        dataString = clid('show version')
        # The "as is" in the license header string from 'show version'
        # will cause json.dumps within taskrunner.py to produce an invalid json string
        # This is resolved by replacing the additional escapes (\) with a raw string
        dataString = dataString.replace("\\\"as is,\\\"", "as is")
        data = json.loads(dataString)
    except:
        pass

    return data

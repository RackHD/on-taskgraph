def main():
    import json
    # Python module names vary depending on nxos version
    try:
        from cli import clid
    except:
        from cisco import clid
    data = {}

    try:
        all = json.loads(clid('show snmp'))
        data['snmp'] = all
    except:
        pass

    try:
        community = json.loads(clid('show snmp community'))
        data['community'] = community
    except:
        pass

    try:
        host = json.loads(clid('show snmp host'))
        data['host'] = host
    except:
        pass

    try:
        group = json.loads(clid('show snmp group'))
        data['group'] = group
    except:
        pass

    return data

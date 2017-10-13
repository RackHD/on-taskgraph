#!/usr/bin/python

import os
import subprocess

def parse_ip(mgmt_ip):
    parsedString = ""

    mgmt_ip = os.linesep.join([s for s in mgmt_ip.splitlines() if s])
    mgmt_ip = mgmt_ip.replace(" ", "")

    for line in mgmt_ip.splitlines():
        if (line.find('Internetaddress') != -1):
            line = line.replace('Internetaddress', 'internetAddress')
            line = line.replace('is', '": "')
            line = '{"' + line + '"}'
            parsedString = line

    return parsedString

def main():
    data = {}

    try:
        cmd = "Cli -c 'show ip interface'"
        mgmt_ip = subprocess.check_output(cmd, shell=True)
        data = parse_ip(mgmt_ip)
    except:
        pass

    return data

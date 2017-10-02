#!/usr/bin/python

def main():
    import subprocess
    data ={}

    try:
        cmd = "Cli -p2 -c 'show startup-config'"
        data['startup-config'] = subprocess.check_output(cmd, shell=True)
    except:
        pass

    try:
        cmd = "Cli -p2 -c 'show running-config'"
        data['running-config'] = subprocess.check_output(cmd, shell=True)
    except:
        pass

    return data

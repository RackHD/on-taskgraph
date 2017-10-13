#!/usr/local/python/3.3.2/bin/python3
import requests
import json
from CLI import CLI
import imp
import traceback
import sys


def download_brocade_config():
    session = requests.Session()
    response = requests.Response()
    response = session.get('<%=startupConfigUri%>', auth=("", ""))
    session.close()
    with open('/var/config/vcs/scripts/rackhd_brocade_config', 'w') as rackhd_brocade_script:
        rackhd_brocade_script.write(response.text)

def main():
  try:   
     download_brocade_config()
     CLI('copy flash://rackhd_brocade_config running-config', do_print=False)
  except:
     pass


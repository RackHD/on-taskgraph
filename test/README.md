## Setup
    virtualenv .venv
    source .venv/bin/activate
    sudo pip install -r requirements.txt
## Running the tests
####To change the base URL (default 172.31.128.1:9030):
    export BASEURL="111.111.111.111:8000"
#### Run tests    
    nosetests -v --exe

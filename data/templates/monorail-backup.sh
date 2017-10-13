set -e
set -o pipefail

cd /tmp
rm -f /tmp/monorail_backup_files.txt

backup_file=$1
repository='$repo'

function for_each_repo() {
    for repo in on-http on-taskgraph on-dhcp-proxy on-tftp on-syslog;
    do
        eval $*
    done
}

function stop_service() {
    echo $1
    status=`sudo initctl status $1`
    if [[ "$status" != "$1 stop/waiting" ]];
    then
        sudo initctl stop $1
    fi
}

function add_file() {
    echo $1
    echo $1 >> "./monorail_backup_files.txt"
}

function echo_progress() {
    echo
    echo "#========================================================#"
    echo "#    "$*
    echo "#========================================================#"
    echo
}

function get_config_value() {
    cat /opt/monorail/config.json | python -m json.tool | grep $1 | cut -f4 -d '"'
}

if [ -z "$backup_file" ];
then
    echo "Path to backup file is not set!"
    echo "sudo ./monorail-backup.sh <backup_file>"
    exit 1
fi

echo_progress "Shutting down services..."
for_each_repo "stop_service \"$repository\""
echo dhcpd
if pgrep dhcpd
then
    sudo killall dhcpd
fi

# --------
# Mongo
# --------
echo_progress "Creating mongo database backup..."
mongodb=`get_config_value mongo`
# Get last field delimited by '/'
db=${mdb##*/}
mongodump -d $db

# --------

echo_progress "Generating backup file list..."

add_file "./dump"

# --------
# Configuration
# --------
add_file "/opt/monorail/config.json"

# --------
# Version/commit information. These won't get restored but provide useful debug information.
# --------
for_each_repo "add_file \"/var/renasar/$repository/commitstring.txt\""

# --------
# DHCP
# --------
add_file "/var/lib/dhcp/dhcpd.leases"

# --------
# Files
# --------
add_file "/var/renasar/on-http/static"
static_files=`get_config_value httpStaticRoot`
add_file static_files
file_service_files=`get_config_value httpFileServiceRoot`
add_file file_service_files

# --------
# Make the upgrade blob
# --------
echo_progress "Compressing upgrade files..."
echo -e $file_list > files.txt
sudo tar --ignore-failed-read -czvf $backup_file -T /tmp/monorail_backup_files.txt

echo_progress "Upgrade blob created at /tmp/$backup_file"

echo_progress "Restarting services..."
for_each_repo "sudo initctl start \"$repository\""

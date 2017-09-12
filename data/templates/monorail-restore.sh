set -e

cd /tmp

restore_file=$1
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

if [ -z "$restore_file" ];
then
    echo "Path to restore file is not set!"
    echo "sudo ./monorail-restore.sh <restore_file>"
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
echo_progress "Dropping existing mongo database..."
mongodb=`get_config_value mongo`
# Get last field delimited by '/'
db=${mdb##*/}
mongo $db --eval "db.dropDatabase()"
echo_progress "Restoring mongo database..."
tar -xzvf $restore_file "./dump"
mongorestore ./dump

# --------
# Configuration
# --------
echo_progress "Restoring configuration files..."
if tar -tzf $restore_file | grep -q "opt\/monorail\/config.json";
then
    static_files=`httpStaticRoot
    file_service_files=`cat /opt/monorail/config.json | python -m json.tool | grep httpFileServiceRoot | cut -f4 -d '"'`
    tar -xzvf $restore_file "opt/monorail/config.json" -C /
fi

# --------
# DHCP
# --------
echo_progress "Restoring DHCP leases..."
tar -C / -xzvf $restore_file "var/lib/dhcp/dhcpd.leases"

# --------
# Files
# --------
echo_progress "Restoring static and user files (not overwriting existing ones)..."
tar -C / --keep-old-files --wildcards "var/renasar/on-http/static/*" -xzvf $restore_file
if [ -z "$static_files" ];
then
    tar -C / --keep-old-files -xzvf "$static_files"
fi
if [ -z "$file_service_files" ];
then
    tar -C / --keep-old-files -xzvf "$file_service_files"
fi

# --------
# Start
# --------
echo_progress "Starting services..."
for_each_repo "sudo initctl start \"$repository\""
echo dhcpd
sudo dhcpd

echo_progress "Restored from /tmp/$restore_file!"

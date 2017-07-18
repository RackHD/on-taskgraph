#!/bin/bash
# get the system information when docker image builds. And encrypt the info into file "build_image_info.encrypted" using RSA encryption algorithm.
# Purpose: figure out RAC-5468. 
# If you want to decrypt the file "build_image_info.encrypted", please contact Qiang, Peter, Alan, Leo.

set -x

cur_time=$(date)
cur_user=$USER
cur_path=$(pwd)

# get the jenkins build url if the docker image is built by jenkins job.
build_url=$(env | grep "BUILD_URL")

user_login=$(who)
hostname=$(hostname)
ip_info=$(ifconfig | grep "inet addr")
os_info=$(lsb_release -a)

cd $(dirname $0)
echo -e "current time:${cur_time}\ncurrent user:${cur_user}\ncurrent path:${cur_path}\njenkins job build url:${build_url}\n\nuser login:\n${user_login}\n\nhostname:${hostname}\n\nip info:\n${ip_info}\n\nos info:\n${os_info}" | openssl rsautl -encrypt -pubin -inkey build_image_key.pub > build_image_info.encrypted 

echo "get docker build image info done."

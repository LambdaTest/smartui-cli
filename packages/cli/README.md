# SmartUI CLI
[![SmartUI-Testing](https://smartui.lambdatest.com/static/media/LTBadge.64a05e73.svg)](https://smartui.lambdatest.com)

The SmartUI CLI is used to create configs, take screenshots and upload to [SmartUI Dashboard](https://smartui.lambdatest.com/) via
the command line.

- [Installation](#installation)
- [Start using CLI](#start-using-cli)

## Installation

```sh-session
$ npm install -g @lambdatest/smartui-cli --force
```

## Start using CLI 

#### Create URL Json file
```sh-session
$ smartui config:web-static urls.json
```

#### Create custom Web Config file
```sh-session
$ smartui config:create-web smartui-web.json
```

#### Configure your Project Token

Create a new web project from [SmartUI Dashboard](https://smartui.lambdatest.com/) and copy the project token and set on CLI via command

<b>For Linux/macOS:</b>

```
 export PROJECT_TOKEN="****-****-****-************"
```

<b>For Windows:</b>

```
 set PROJECT_TOKEN="****-****-****-************"
```
  
#### Capture Screenshots
```sh-session
$ smartui capture urls.json --config smartui-web.json
```

'use strict';

const Grid = ReactBootstrap.Grid;
const Row = ReactBootstrap.Row;
const Col = ReactBootstrap.Col;
const Nav = ReactBootstrap.Nav;
const NavItem = ReactBootstrap.NavItem;
const Badge = ReactBootstrap.Badge;

const electron = require('electron');
const remote = electron.remote;

const osLocale = require('os-locale');
const fs = require('fs');
const url = require('url');

const settings = require('../common/settings');

var MainPage = React.createClass({
  getInitialState: function() {
    return {
      key: 0,
      unreadCounts: new Array(this.props.teams.length)
    };
  },
  handleSelect: function(key) {
    this.setState({
      key: key
    });
  },
  handleUnreadCountChange: function(index, count) {
    var counts = this.state.unreadCounts;
    counts[index] = count;
    this.setState({
      unreadCounts: counts
    });
  },
  visibleStyle: function(visible) {
    var visibility = visible ? 'initial' : 'hidden';
    return {
      position: 'absolute',
      top: 42,
      right: 0,
      bottom: 0,
      left: 0,
      visibility: visibility
    };
  },
  render: function() {
    var thisObj = this;
    var tabs = this.props.teams.map(function(team, index) {
      var badge;
      if (thisObj.state.unreadCounts[index] != 0) {
        badge = (<Badge>
                   { thisObj.state.unreadCounts[index] }
                 </Badge>);
      }
      return (<NavItem eventKey={ index }>
                { team.name }
                { ' ' }
                { badge }
              </NavItem>);
    });
    var views = this.props.teams.map(function(team, index) {
      var handleUnreadCountChange = function(count) {
        thisObj.handleUnreadCountChange(index, count);
      };
      return (<MattermostView style={ thisObj.visibleStyle(thisObj.state.key === index) } src={ team.url } onUnreadCountChange={ handleUnreadCountChange } />)
    });
    return (
      <Grid fluid>
        <Row>
          <Nav bsStyle="tabs" activeKey={ this.state.key } onSelect={ this.handleSelect }>
            { tabs }
          </Nav>
        </Row>
        <Row>
          { views }
        </Row>
      </Grid>
      );
  }
});


var MattermostView = React.createClass({
  getInitialState: function() {
    return {
      unreadCount: 0
    };
  },
  handleUnreadCountChange: function(count) {
    this.setState({
      unreadCount: count
    });
    if (this.props.onUnreadCountChange) {
      this.props.onUnreadCountChange(count);
    }
  },
  componentDidMount: function() {
    var thisObj = this;
    var webview = ReactDOM.findDOMNode(this.refs.webview);

    // Open link in browserWindow. for exmaple, attached files.
    webview.addEventListener('new-window', function(e) {
      var currentURL = url.parse(webview.getURL());
      var destURL = url.parse(e.url);
      if (currentURL.host === destURL.host) {
        window.open(e.url, 'electron-mattermost');
      } else {
        // if the link is external, use default browser.
        require('shell').openExternal(e.url);
      }
    });

    webview.addEventListener("dom-ready", function() {
      // webview.openDevTools();

      // Use 'Meiryo UI' and 'MS Gothic' to prevent CJK fonts on Windows(JP).
      if (process.platform === 'win32') {
        var applyCssFile = function(cssFile) {
          fs.readFile(cssFile, 'utf8', function(err, data) {
            if (err) {
              console.log(err);
              return;
            }
            webview.insertCSS(data);
          });
        };

        osLocale(function(err, locale) {
          if (err) {
            console.log(err);
            return;
          }
          if (locale === 'ja_JP') {
            applyCssFile(__dirname + '/css/jp_fonts.css');
          }
        });
      }
    });

    webview.addEventListener('ipc-message', function(event) {
      switch (event.channel) {
        case 'onUnreadCountChange':
          var unreadCount = event.args[0];
          thisObj.handleUnreadCountChange(unreadCount);
          break;
      }
    });

  },
  render: function() {
    // 'disablewebsecurity' is necessary to display external images.
    // However, it allows also CSS/JavaScript.
    // So webview should use 'allowDisplayingInsecureContent' as same as BrowserWindow.
    return (<webview style={ this.props.style } preload="webview/mattermost.js" src={ this.props.src } ref="webview"></webview>);
  }
});


var configFile = remote.getGlobal('config-file');
var config = settings.readFileSync(configFile);

ReactDOM.render(
  <MainPage teams={ config.teams } />,
  document.getElementById('content')
);
